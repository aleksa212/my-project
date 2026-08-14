import express from "express";
import { Vehicle } from "../models/Vehicle.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

/* ==================== LIST ====================
   Optional ?airportCode=PDX to scope to one
   airport's fleet.
================================================= */
router.get("/", auth, async (req, res) => {
    try {
        const filter = { active: true };

        if (req.query.airportCode) {
            filter.airportCode = req.query.airportCode;
        }

        const vehicles = await Vehicle.find(filter);
        res.json(vehicles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== CREATE ==================== */

router.post("/", auth, async (req, res) => {
    try {
        const { vehicleNumber, airportCode, type, capacity } = req.body;

        if (!vehicleNumber || !airportCode || !type || !capacity) {
            return res.status(400).json({
                error: "vehicleNumber, airportCode, type, and capacity are required"
            });
        }

        // Stored airport-prefixed (e.g. "PDX-673") so numbers stay
        // unambiguous and readable across a fleet spanning many airports —
        // same idea as Driver.displayName, but composed once at creation
        // rather than kept as a separate virtual, since VEHnumber is used
        // as the literal matching key everywhere else in the codebase.
        const fullVehicleNumber = `${airportCode}-${vehicleNumber.trim()}`;

        const exists = await Vehicle.findOne({ vehicleNumber: fullVehicleNumber });
        if (exists) {
            return res.status(400).json({ error: "A vehicle with that number already exists at this airport" });
        }

        const vehicle = await Vehicle.create({
            vehicleNumber: fullVehicleNumber,
            airportCode,
            type,
            capacity: Number(capacity)
        });

        res.status(201).json(vehicle);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete("/:id", auth, async (req, res) => {
    try {
        const vehicle = await Vehicle.findByIdAndUpdate(
            req.params.id,
            { active: false },
            { returnDocument: "after" }
        );
        if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
        res.json(vehicle);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;