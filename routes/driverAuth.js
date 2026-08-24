import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Driver } from "../models/Driver.js";

const router = express.Router();

const driverPublicShape = (driver) => ({
    id: driver._id,
    displayName: driver.displayName,
    name: driver.name,
    email: driver.email,
    airportCode: driver.airportCode
});

/* ==================== DRIVER AUTH ====================
   Separate from routes/auth.js (User/dispatcher login) --
   drivers aren't Users, they're Driver records a dispatcher
   already created via the web app's Drivers management
   (name + airportCode required there). Registering here
   doesn't create a new driver from scratch; it links a
   password to an EXISTING driver record by matching email,
   which is exactly why driver emails need to be accurate
   (see the conversation this was built from -- the driver
   emails were just corrected for this specific reason).
================================================================= */

router.post("/register", async (req, res) => {
    try {
        const { email, password, confirmPassword } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        const driver = await Driver.findOne({ email }).select("+password");
        if (!driver) {
            return res.status(404).json({
                message: "No driver account found for this email — ask your dispatcher to add you first"
            });
        }
        if (driver.password) {
            return res.status(400).json({ message: "This email is already registered — log in instead" });
        }

        driver.password = await bcrypt.hash(password, 10);
        await driver.save();

        const token = jwt.sign({ id: driver._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

        res.status(201).json({ token, driver: driverPublicShape(driver) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const driver = await Driver.findOne({ email }).select("+password");
        if (!driver || !driver.password) {
            return res.status(400).json({ message: "No account found — register first" });
        }

        const match = await bcrypt.compare(password, driver.password);
        if (!match) {
            return res.status(400).json({ message: "Invalid password" });
        }

        const token = jwt.sign({ id: driver._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

        res.json({ token, driver: driverPublicShape(driver) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
