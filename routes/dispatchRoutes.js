import express from "express";
import { auth } from "../middleware/auth.js";
import { runAutoDispatch } from "../utils/autoDispatch.js";
import { Reservation } from "../models/Reservation.js";
import { getVehicleType } from "../utils/vehicles.js";
import { createLogs } from "../utils/logs.js";

const router = express.Router();

const AUTO_DISPATCH_USER = { firstName: "Auto", lastName: "Dispatch" };

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

export default router;