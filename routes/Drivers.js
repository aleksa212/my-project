import express from "express";
import { Driver } from "../models/Driver.js";
import { DriverDayOverride } from "../models/DriverDayOverride.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

/* ==================== LIST ====================
   Optional ?airportCode=PDX to scope to one
   airport's pool — this is what the auto-dispatch
   engine and any driver dropdowns will use later.
================================================= */
router.get("/", auth, async (req, res) => {
    try {
        const filter = { active: true };

        if (req.query.airportCode) {
            filter.airportCode = req.query.airportCode;
        }

        const drivers = await Driver.find(filter);
        res.json(drivers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== CREATE ==================== */

router.post("/", auth, async (req, res) => {
    try {
        const { name, airportCode, phone, email, schedule } = req.body;

        if (!name || !airportCode) {
            return res
                .status(400)
                .json({ error: "name and airportCode are required" });
        }

        const driver = await Driver.create({
            name,
            airportCode,
            phone,
            email,
            schedule: schedule || []
        });

        res.status(201).json(driver);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== UPDATE ====================
   Edits a driver's contact info and/or their default
   recurring weekly schedule. Day-specific one-off
   changes (call-outs, a shortened shift for a single
   date) go through the separate day-override routes
   below instead — this only touches the standing
   default.
================================================= */
router.put("/:id", auth, async (req, res) => {
    try {
        const { name, phone, email, schedule } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (phone !== undefined) updates.phone = phone;
        if (email !== undefined) updates.email = email;
        if (schedule !== undefined) updates.schedule = schedule;

        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!driver) return res.status(404).json({ error: "Driver not found" });
        res.json(driver);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== DAY OVERRIDES ====================
   Per-date exceptions to a driver's default weekly
   schedule — call-outs and one-off hour changes for
   auto-dispatch, without touching the standing
   default. Consulted by runAutoDispatch() alongside
   the airport/date it's already given.
========================================================= */

// List every override for one airport's active drivers on one date —
// what the Auto Dispatch modal loads to show that day's roster.
router.get("/day-overrides", auth, async (req, res) => {
    try {
        const { airportCode, date } = req.query;
        if (!airportCode || !date) {
            return res.status(400).json({ error: "airportCode and date are required" });
        }

        const drivers = await Driver.find({ airportCode, active: true });
        const overrides = await DriverDayOverride.find({
            driver: { $in: drivers.map(d => d.id) },
            date
        });

        res.json(overrides);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upsert one driver's override for one date.
router.put("/:id/day-override", auth, async (req, res) => {
    try {
        const { date, available, startTime, endTime } = req.body;
        if (!date) return res.status(400).json({ error: "date is required" });

        const override = await DriverDayOverride.findOneAndUpdate(
            { driver: req.params.id, date },
            {
                driver: req.params.id,
                date,
                available: available !== undefined ? available : true,
                startTime: startTime || "",
                endTime: endTime || ""
            },
            { new: true, upsert: true, runValidators: true }
        );

        res.json(override);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear a driver's override for one date, reverting to their default schedule.
router.delete("/:id/day-override", auth, async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: "date is required" });

        await DriverDayOverride.deleteOne({ driver: req.params.id, date });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== REMOVE ====================
   Soft-delete only — sets active:false rather than
   actually deleting the document, so past trips/logs
   that reference this driver by name still make sense
   when looked back on later.
================================================= */
router.delete("/:id", auth, async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { active: false },
            { new: true }
        );
        if (!driver) return res.status(404).json({ error: "Driver not found" });
        res.json(driver);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;