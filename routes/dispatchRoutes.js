import express from "express";
import { auth } from "../middleware/auth.js";
import { runAutoDispatch, findScheduleConflicts } from "../utils/autoDispatch.js";
import { Reservation } from "../models/Reservation.js";
import { getVehicleType } from "../utils/vehicles.js";
import { createLogs } from "../utils/logs.js";

const router = express.Router();

const AUTO_DISPATCH_USER = { firstName: "Auto", lastName: "Dispatch" };
const CONFLICT_CHECK_USER = { firstName: "Conflict", lastName: "Check" };
const CONFLICT_NOTE = "conflicted trip";

router.post("/preview", auth, async (req, res) => {
    try {
        const { airportCode, date, tripIds } = req.body;
        if (!airportCode || !date) {
            return res.status(400).json({ error: "airportCode and date are required" });
        }
        const plan = await runAutoDispatch(airportCode, date, { tripIds });
        res.json(plan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/commit", auth, async (req, res) => {
    try {
        const { assignments } = req.body;
        const updated = [];

        for (const a of assignments) {
            const reservation = await Reservation.findById(a.tripId);
            if (!reservation) continue;

            const updates = {
                Driver: a.driverName,
                VEHnumber: a.vehicleNumber,
                VEHtype: await getVehicleType(a.vehicleNumber),
                Status: "dispatched"
            };

            const logs = createLogs(reservation, updates, AUTO_DISPATCH_USER);

            reservation.Driver = updates.Driver;
            reservation.VEHnumber = updates.VEHnumber;
            reservation.VEHtype = updates.VEHtype;
            reservation.Status = updates.Status;
            reservation.assignedBy = "auto";

            if (a.tripDurationMinutes != null) reservation.tripDurationMinutes = a.tripDurationMinutes;
            if (a.estimatedDropoff) reservation.estimatedDropoff = new Date(a.estimatedDropoff);

            if (logs.length) reservation.logs.push(...logs);

            await reservation.save();
            updated.push(reservation);
        }

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== CHECK CONFLICTS ====================
   Re-validates every already-dispatched trip for an airport/date against
   the same rules runAutoDispatch enforces — catches a schedule that
   silently broke after the fact (e.g. syncing a pickup time to a
   flight's real arrival pushed a driver past feasibility). Nothing gets
   reassigned; flagged trips just get Status "needs attention" and
   "conflicted trip" appended to DISPnotes (once — safe to re-run without
   piling up duplicate notes) so they're easy to spot in the grid.
================================================================= */
router.post("/check-conflicts", auth, async (req, res) => {
    try {
        const { airportCode, date } = req.body;
        if (!airportCode || !date) {
            return res.status(400).json({ error: "airportCode and date are required" });
        }

        const conflicts = await findScheduleConflicts(airportCode, date);
        const flagged = [];

        for (const { trip, reasons } of conflicts) {
            const alreadyNoted = (trip.DISPnotes || "").includes(CONFLICT_NOTE);
            const updates = {
                Status: "needs attention",
                DISPnotes: alreadyNoted
                    ? trip.DISPnotes
                    : [trip.DISPnotes, CONFLICT_NOTE].filter(Boolean).join(" | ")
            };

            const logs = createLogs(trip, updates, CONFLICT_CHECK_USER);

            trip.Status = updates.Status;
            trip.DISPnotes = updates.DISPnotes;
            if (logs.length) trip.logs.push(...logs);

            await trip.save();
            flagged.push({ tripId: trip._id, PUtime: trip.PUtime, Driver: trip.Driver, reasons });
        }

        res.json({ flagged, checked: conflicts.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;