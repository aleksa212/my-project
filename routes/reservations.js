import express from "express";
import { Reservation } from "../models/Reservation.js";
import { auth } from "../middleware/auth.js";
import { getAirportCode, getAirportName, airportTimeZones } from "../utils/airports.js";
import { getVehicleType } from "../utils/vehicles.js";
import { createLogs } from "../utils/logs.js";
import { claimNextTripNumber, releaseTripNumber } from "../utils/tripNumbers.js";
import { getAirportArrivals, matchFlight, summarizeArrival } from "../utils/flightAware.js";
import { cancelPendingOfferForTrip } from "../utils/tripOfferEngine.js";

const router = express.Router();

// Covered by Uber instead of the in-house fleet -- these two statuses
// never carry a Driver/vehicle, enforced below regardless of what a
// client also sends for those fields in the same request.
const UBER_STATUSES = ["Order Uber", "Uber OTW"];

/* ==================== GET ALL (PAGINATED) ====================
   Server-side pagination + filtering, mirroring what Table.jsx used to
   do client-side over the full collection. Necessary once the
   collection grows into the thousands — fetching and re-filtering
   every reservation on every keystroke doesn't stay fast at that size,
   whereas a scoped, indexed-ish Mongo query + skip/limit does. Search
   text is matched against the same fields the old client-side
   searchBlob covered (minus PUdate, which is a Date field and has its
   own dedicated `date` param instead of free-text matching).
================================================================= */

const SEARCH_FIELDS = [
    "Status", "PUtime", "PUlocation", "PUlocationCode",
    "DOlocation", "DOlocationCode", "FlightNumber",
    "FLTscheduled", "FLTactual", "FLTstatus",
    "VEHtype", "VEHnumber", "Driver", "PAX", "TripInfo"
];

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));

        const search = (req.query.search || "").trim();
        const idSearch = (req.query.idSearch || "").trim();
        const date = (req.query.date || "").trim();
        const airportCodes = (req.query.airportFilter || "")
            .split(",")
            .map(c => c.trim())
            .filter(Boolean);

        const conditions = [];

        // Matches the old client behavior: an ID search takes over the
        // date filter entirely rather than combining with it.
        if (idSearch) {
            const num = Number(idSearch);
            conditions.push({ tripNumber: Number.isNaN(num) ? -1 : num });
        } else if (date) {
            // PUdate is stored as UTC midnight of the intended calendar
            // day (see PUdate handling below and in autoDispatch.js).
            conditions.push({ PUdate: new Date(`${date}T00:00:00.000Z`) });
        }

        if (airportCodes.length) {
            conditions.push({
                $or: [
                    { PUlocationCode: { $in: airportCodes } },
                    { DOlocationCode: { $in: airportCodes } }
                ]
            });
        }

        if (search) {
            const regex = new RegExp(escapeRegex(search), "i");
            conditions.push({ $or: SEARCH_FIELDS.map(field => ({ [field]: regex })) });
        }

        const filter = conditions.length ? { $and: conditions } : {};

        const [data, total] = await Promise.all([
            Reservation.find(filter)
                .sort({ PUdate: 1, PUtime: 1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Reservation.countDocuments(filter)
        ]);

        res.json({ data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== TRIP NUMBER CLAIM/RELEASE ====================
   The "New Reservation" form claims a number the moment it opens, so
   the dispatcher sees the exact ID that will be saved before they've
   even finished filling the form out. If they close without saving,
   the frontend calls release so that number goes back into the gap
   pool instead of being burned. Both routes must come before "/:id" so
   Express doesn't try to match "next-trip-id"/"release-trip-id" as an
   :id param.
======================================================== */

router.post("/next-trip-id", auth, async (req, res) => {
    try {
        const tripNumber = await claimNextTripNumber();
        res.json({ tripNumber });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/release-trip-id", auth, async (req, res) => {
    try {
        const { tripNumber } = req.body;
        await releaseTripNumber(tripNumber);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== FLIGHT INFO REFRESH ====================
   One AeroAPI call per airport covers every arriving flight there,
   rather than one call per reservation — matched locally against each
   trip's FlightNumber. Only trips whose pickup IS the airport are in
   scope (PUlocationCode === airportCode) — hotel pickups/departures
   don't need arrival tracking. AeroAPI only has schedule data for
   roughly the past ~11 days through ~2 days ahead; a date further out
   than that will just come back with nothing matched yet, which is
   normal, not an error.
================================================================= */
router.post("/refresh-flights", auth, async (req, res) => {
    try {
        const { airportCode, date } = req.body;
        if (!airportCode || !date) {
            return res.status(400).json({ error: "airportCode and date are required" });
        }

        const timeZone = airportTimeZones[airportCode];
        if (!timeZone) {
            return res.status(400).json({ error: `No time zone configured for airport "${airportCode}"` });
        }

        const arrivals = await getAirportArrivals(airportCode);

        const candidates = await Reservation.find({
            Area: airportCode,
            PUlocationCode: airportCode
        });
        const tripsForDate = candidates.filter(
            t => new Date(t.PUdate).toISOString().slice(0, 10) === date
        );

        const updated = [];
        const unmatched = [];

        for (const trip of tripsForDate) {
            const flight = matchFlight(arrivals, trip.FlightNumber, { expectedDate: date, timeZone });
            if (!flight) {
                unmatched.push({ tripId: trip._id, FlightNumber: trip.FlightNumber });
                continue;
            }

            const { FLTscheduled, FLTactual, FLTstatus } = summarizeArrival(flight, timeZone);
            trip.FLTscheduled = FLTscheduled;
            trip.FLTactual = FLTactual;
            trip.FLTstatus = FLTstatus;
            await trip.save();

            updated.push({ tripId: trip._id, FlightNumber: trip.FlightNumber, FLTscheduled, FLTactual, FLTstatus });
        }

        res.json({ updated, unmatched, arrivalsChecked: arrivals.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== CREATE ==================== */

router.post("/", async (req, res) => {
    try {
        if (req.body.tripNumber == null) {
            return res.status(400).json({
                error: "tripNumber is required — claim one via POST /reservations/next-trip-id first"
            });
        }

        const puCode = getAirportCode(req.body.PUlocation);
        const doCode = getAirportCode(req.body.DOlocation);

        // getVehicleType now looks up the real Vehicle collection, so
        // it has to be awaited before use.
        const vehType = await getVehicleType(req.body.VEHnumber);

        const reservation = new Reservation({
            Status: "Unassigned",

            ...req.body,

            // only set if found
            PUlocationCode: puCode || "",
            PUlocationName: puCode ? getAirportName(puCode) : "",

            DOlocationCode: doCode || "",
            DOlocationName: doCode ? getAirportName(doCode) : "",

            // VEHtype is never taken from the client — always derived
            // from VEHnumber so it can't be set inconsistently.
            VEHtype: vehType,

            PUdate: new Date(req.body.PUdate)
        });

        await reservation.save();
        res.status(201).json(reservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== UPDATE ==================== */

router.put("/:id", auth, async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ error: "Not found" });
        }

        const updates = req.body;

        // "Bidding" is system-managed only (see utils/tripOfferEngine.js)
        // -- a dispatcher can dispatch a trip manually at any time (which
        // takes priority and is handled below), but can't set this
        // status directly.
        if (updates.Status === "Bidding") {
            return res.status(400).json({ error: "Status \"Bidding\" is system-managed and can't be set manually." });
        }

        const wasBidding = reservation.Status === "Bidding";

        // =========================
        // 1. SAFE FIELD UPDATE (NO OVERWRITES WITH UNDEFINED)
        // =========================
        const allowedFields = [
            "Status",
            "FLTscheduled",
            "FLTactual",
            // NOTE: "VEHtype" is intentionally excluded — it is never
            // accepted directly from the client. It's always derived
            // from VEHnumber below (see VEHICLE NORMALIZATION).
            "VEHnumber",
            "Driver",
            "FLTstatus",
            "Area",
            "PUlocation",
            "DOlocation",
            "PUdate",
            "PUtime",
            "FlightNumber",
            "PAX",
            "DISPnotes",
            "TripInfo",
            "Account",
            "Price"
        ];

        const safeUpdates = {};

        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                safeUpdates[key] = updates[key];
            }
        }

        // =========================
        // 2. AIRPORT NORMALIZATION (ONLY IF PROVIDED)
        // =========================
        const puCode = updates.PUlocation
            ? getAirportCode(updates.PUlocation)
            : undefined;

        const doCode = updates.DOlocation
            ? getAirportCode(updates.DOlocation)
            : undefined;

        if (updates.PUlocation !== undefined) {
            safeUpdates.PUlocationCode = puCode || "";
            safeUpdates.PUlocationName = puCode
                ? getAirportName(puCode)
                : "";
        }

        if (updates.DOlocation !== undefined) {
            safeUpdates.DOlocationCode = doCode || "";
            safeUpdates.DOlocationName = doCode
                ? getAirportName(doCode)
                : "";
        }

        // =========================
        // 2b. VEHICLE NORMALIZATION (ONLY IF PROVIDED)
        // VEHtype is always derived from VEHnumber — a client can
        // never set VEHtype independently of the vehicle it's on.
        // =========================
        if (updates.VEHnumber !== undefined) {
            safeUpdates.VEHtype = await getVehicleType(updates.VEHnumber);
        }

        // =========================
        // 2b2. UBER COVERAGE
        // No in-house driver/vehicle on an Uber trip -- forced regardless
        // of whatever the client also sent for those fields, so this can
        // never drift into a trip that's simultaneously "Uber OTW" and
        // holding onto a real driver/vehicle assignment.
        // =========================
        if (UBER_STATUSES.includes(safeUpdates.Status)) {
            safeUpdates.Driver = "";
            safeUpdates.VEHnumber = "";
            safeUpdates.VEHtype = "";
        }

        // =========================
        // 2c. ASSIGNMENT SOURCE TRACKING
        // Manual edits to Driver/VEHnumber always take priority over
        // auto-dispatch — mark the trip so a later auto-dispatch run
        // treats it as fixed and never reassigns it. Explicitly setting
        // Status back to "Unassigned" reopens it for auto-dispatch again.
        // =========================
        if (safeUpdates.Status === "Unassigned") {
            safeUpdates.assignedBy = null;
        } else if (UBER_STATUSES.includes(safeUpdates.Status)) {
            safeUpdates.assignedBy = "uber";
        } else if (safeUpdates.Driver !== undefined || safeUpdates.VEHnumber !== undefined) {
            safeUpdates.assignedBy = "manual";
        }

        // =========================
        // 2d. TIMING CACHE INVALIDATION
        // tripDurationMinutes/estimatedDropoff are only valid for the
        // route/time they were computed against — if any of those
        // change, clear the cache so the next dispatch replay recomputes
        // fresh instead of reusing a stale number.
        // =========================
        const timingFields = ["PUlocation", "DOlocation", "PUdate", "PUtime"];
        if (timingFields.some(f => updates[f] !== undefined)) {
            safeUpdates.tripDurationMinutes = null;
            safeUpdates.estimatedDropoff = null;
        }

        // =========================
        // 3. PRICING MERGE (SAFE NESTED UPDATE)
        // =========================
        if (updates.pricing) {
            safeUpdates.pricing = {
                ...reservation.pricing,
                ...updates.pricing
            };
        }

        // =========================
        // 4. LOGGING (ONLY REAL CHANGES)
        // =========================
        const logs = createLogs(reservation, safeUpdates, req.user);

        // =========================
        // 5. APPLY UPDATES SAFELY
        // =========================
        for (const [key, value] of Object.entries(safeUpdates)) {
            reservation[key] = value;
        }

        if (logs.length) {
            reservation.logs.push(...logs);
        }

        await reservation.save();

        // A dispatcher's manual edit always wins over a pending offer --
        // if this trip was out for driver self-accept, that offer is now
        // moot regardless of what specifically changed.
        if (wasBidding && reservation.Status !== "Bidding") {
            await cancelPendingOfferForTrip(reservation._id);
        }

        res.json(reservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== DELETE ====================
   Cancelling a reservation frees its trip number back into the gap
   pool, so the next new reservation fills it before the counter grows
   any further.
================================================= */

router.delete("/:id", auth, async (req, res) => {
    const reservation = await Reservation.findByIdAndDelete(req.params.id);
    if (reservation?.tripNumber != null) {
        await releaseTripNumber(reservation.tripNumber);
    }
    res.json({ message: "Deleted" });
});

/* ==================== LOGS ==================== */

router.get("/:id/logs", async (req, res) => {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation)
        return res.status(404).json({ error: "Not found" });

    res.json(reservation.logs || []);
});

export default router;
