import express from "express";
import { Reservation } from "../models/Reservation.js";
import { auth } from "../middleware/auth.js";
import { getAirportCode, getAirportName } from "../utils/airports.js";
import { getVehicleType } from "../utils/vehicles.js";
import { createLogs } from "../utils/logs.js";

const router = express.Router();

/* ==================== GET ALL ==================== */

router.get("/", async (req, res) => {
    const data = await Reservation.find();
    res.json(data);
});

/* ==================== CREATE ==================== */

router.post("/", async (req, res) => {
    try {
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
        // 2c. ASSIGNMENT SOURCE TRACKING
        // Manual edits to Driver/VEHnumber always take priority over
        // auto-dispatch — mark the trip so a later auto-dispatch run
        // treats it as fixed and never reassigns it. Explicitly setting
        // Status back to "Unassigned" reopens it for auto-dispatch again.
        // =========================
        if (safeUpdates.Status === "Unassigned") {
            safeUpdates.assignedBy = null;
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

        res.json(reservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== DELETE ==================== */

router.delete("/:id", async (req, res) => {
    await Reservation.findByIdAndDelete(req.params.id);
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
