import express from "express";
import { Driver } from "../models/Driver.js";
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