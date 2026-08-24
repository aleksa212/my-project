import express from "express";
import { Reservation } from "../models/Reservation.js";
import { driverAuth } from "../middleware/driverAuth.js";
import { createLogs } from "../utils/logs.js";

const router = express.Router();

const driverAppUser = (driver) => ({ firstName: "Driver App", lastName: `(${driver.displayName})` });

// Both terminal outcomes count as "done with it" from a driver's point
// of view -- a no-show is still a resolved trip, not one still in
// progress. Shared so Current's exclusion list and Completed's
// inclusion list can't drift out of sync with each other.
const COMPLETED_STATUSES = ["Done", "No show"];

const todayUtcMidnight = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

// "YYYY-MM-DD" (exactly what a native date picker hands back) parsed the
// same UTC-midnight way PUdate is stored everywhere else in this app --
// falls back to today whenever it's missing or malformed, so an
// unrecognized value never silently returns the wrong day's trips.
const parseRequestedDate = (value) => {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    return todayUtcMidnight();
};

/* ==================== MINE ====================
   A driver's own assigned trips (Driver === their
   displayName on the Reservation), split into three
   tabs:
     - pending: Status "dispatched" -- assigned by a
       dispatcher but not yet accepted/declined by
       this driver. Not date-bounded: a driver needs
       to see and act on ALL outstanding assignments,
       not just today's.
     - current: this driver's already-accepted trips
       (anything past "dispatched") for a single date
       -- ?date=YYYY-MM-DD, defaulting to today when
       omitted (the driver app always opens on today;
       date is picker-driven from there). Excludes
       anything already in COMPLETED_STATUSES (those
       live in Completed instead so a trip isn't shown
       twice).
     - completed: Status in COMPLETED_STATUSES (Done or
       No show), bounded to the last 60 days so this
       never turns into an unbounded query as history
       piles up.
   Driver identity comes from the verified JWT
   (req.driver), not a client-supplied id -- unlike
   the older /trip-offers/mine, which still trusts a
   bare driverId query param (see its own comment).
================================================= */
router.get("/mine", driverAuth, async (req, res) => {
    try {
        const driverName = req.driver.displayName;
        const requestedDate = parseRequestedDate(req.query.date);
        const nextDay = new Date(requestedDate.getTime() + 86400000);
        const today = todayUtcMidnight();
        const pastBound = new Date(today.getTime() - 60 * 86400000);

        const [current, pending, completed] = await Promise.all([
            Reservation.find({
                Driver: driverName,
                PUdate: { $gte: requestedDate, $lt: nextDay },
                Status: { $nin: ["dispatched", ...COMPLETED_STATUSES] }
            }).sort({ PUtime: 1 }),

            Reservation.find({
                Driver: driverName,
                Status: "dispatched"
            }).sort({ PUdate: 1, PUtime: 1 }),

            Reservation.find({
                Driver: driverName,
                Status: { $in: COMPLETED_STATUSES },
                PUdate: { $gte: pastBound }
            }).sort({ PUdate: -1, PUtime: -1 })
        ]);

        res.json({ current, pending, completed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== ACCEPT / DECLINE ====================
   Only valid on a trip that's actually "dispatched" (waiting
   on this driver) and actually assigned to THIS driver --
   scoping the lookup by Driver: req.driver.displayName means
   a driver can never act on someone else's trip by guessing
   an id.
================================================= */

router.post("/:tripId/accept", driverAuth, async (req, res) => {
    try {
        const trip = await Reservation.findOne({ _id: req.params.tripId, Driver: req.driver.displayName });
        if (!trip) return res.status(404).json({ error: "Trip not found" });
        if (trip.Status !== "dispatched") {
            return res.status(409).json({ error: `This trip is "${trip.Status}", not waiting on your acceptance.` });
        }

        const updates = { Status: "accepted" };
        const logs = createLogs(trip, updates, driverAppUser(req.driver));

        trip.Status = updates.Status;
        if (logs.length) trip.logs.push(...logs);
        await trip.save();

        res.json(trip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== ADVANCE ====================
   Driver-driven progression through an accepted trip, one step at
   a time. "confirmed" is a dispatcher-only marker set from the web
   app once they've called the driver to double-check they're
   coming in -- it's for the grid's benefit, not a gate the driver
   has to wait behind, so the driver can advance straight from
   "accepted" just as well as from "confirmed" (whichever the trip
   happens to be in when they tap the button). Each key is the ONLY
   status this endpoint will advance FROM; anything else (still
   "dispatched", already "Done", etc.) is rejected -- same
   validated-transition pattern as accept/decline, just a chain
   instead of a single hop.
================================================= */
const STATUS_PROGRESSION = {
    accepted: "On the way",
    confirmed: "On the way",
    "On the way": "Arrived",
    Arrived: "Customer in car",
    "Customer in car": "Done"
};

router.post("/:tripId/advance", driverAuth, async (req, res) => {
    try {
        const trip = await Reservation.findOne({ _id: req.params.tripId, Driver: req.driver.displayName });
        if (!trip) return res.status(404).json({ error: "Trip not found" });

        const nextStatus = STATUS_PROGRESSION[trip.Status];
        if (!nextStatus) {
            return res.status(409).json({ error: `This trip is "${trip.Status}" and can't be advanced from here.` });
        }

        const updates = { Status: nextStatus };
        const logs = createLogs(trip, updates, driverAppUser(req.driver));

        trip.Status = updates.Status;
        if (logs.length) trip.logs.push(...logs);
        await trip.save();

        res.json(trip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== REQUEST NO SHOW ====================
   The other branch out of "Arrived", alongside /advance's normal
   "Customer in car" hop -- a driver who actually got to the
   pickup but the customer never showed flags it here rather than
   a dispatcher having to take their word for it over the phone.
   Deliberately NOT the real "No show" status: that's still a
   dispatcher-only call via the web app's status dropdown, once
   they've confirmed with the driver, same as "confirmed" is for
   the accepted step. Only valid from "Arrived" -- a driver can't
   request a no-show before actually claiming to have arrived.
================================================= */
router.post("/:tripId/request-no-show", driverAuth, async (req, res) => {
    try {
        const trip = await Reservation.findOne({ _id: req.params.tripId, Driver: req.driver.displayName });
        if (!trip) return res.status(404).json({ error: "Trip not found" });
        if (trip.Status !== "Arrived") {
            return res.status(409).json({ error: `This trip is "${trip.Status}", not "Arrived" -- can't request a no-show yet.` });
        }

        const updates = { Status: "Request no show" };
        const logs = createLogs(trip, updates, driverAppUser(req.driver));

        trip.Status = updates.Status;
        if (logs.length) trip.logs.push(...logs);
        await trip.save();

        res.json(trip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/:tripId/decline", driverAuth, async (req, res) => {
    try {
        const trip = await Reservation.findOne({ _id: req.params.tripId, Driver: req.driver.displayName });
        if (!trip) return res.status(404).json({ error: "Trip not found" });
        if (trip.Status !== "dispatched") {
            return res.status(409).json({ error: `This trip is "${trip.Status}", not waiting on your acceptance.` });
        }

        // Back into the pool for re-dispatch, with a note so a dispatcher
        // sees WHY it's Unassigned again rather than just finding it
        // silently reset.
        const updates = {
            Status: "Unassigned",
            Driver: "",
            VEHnumber: "",
            DISPnotes: [trip.DISPnotes, `declined by ${req.driver.displayName}`].filter(Boolean).join(" | ")
        };
        const logs = createLogs(trip, updates, driverAppUser(req.driver));

        trip.Status = updates.Status;
        trip.Driver = updates.Driver;
        trip.VEHnumber = updates.VEHnumber;
        trip.VEHtype = "";
        trip.assignedBy = null;
        trip.DISPnotes = updates.DISPnotes;
        if (logs.length) trip.logs.push(...logs);
        await trip.save();

        res.json(trip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
