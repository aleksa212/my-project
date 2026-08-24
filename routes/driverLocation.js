import express from "express";
import { Driver } from "../models/Driver.js";
import { driverAuth } from "../middleware/driverAuth.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// A location older than this reads as stale rather than live -- a driver
// who force-quit the app or whose phone died hours ago shouldn't still
// show up as a moving dot on the dispatcher map.
const STALE_AFTER_MS = 15 * 60 * 1000;

/* ==================== PING (driver app) ====================
   The driver app's background location task calls this every few
   seconds while tracking is on. Only ever overwrites this driver's
   OWN location (scoped by req.driver, same pattern as driverTrips.js)
   -- there's no id in the URL to spoof.
================================================= */
router.post("/", driverAuth, async (req, res) => {
    try {
        const { lat, lng } = req.body;
        if (typeof lat !== "number" || typeof lng !== "number") {
            return res.status(400).json({ message: "lat and lng (numbers) are required" });
        }

        req.driver.location = { lat, lng, updatedAt: new Date() };
        await req.driver.save();

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== LIST (dispatcher map) ====================
   Every active driver with a location less than STALE_AFTER_MS old --
   drivers who've never opened the app (location.updatedAt: null) or
   gone quiet too long are left out rather than shown at a stale point.
================================================= */
router.get("/", auth, async (req, res) => {
    try {
        const cutoff = new Date(Date.now() - STALE_AFTER_MS);

        const drivers = await Driver.find({
            active: true,
            "location.updatedAt": { $gte: cutoff }
        }).select("name airportCode location");

        res.json(drivers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
