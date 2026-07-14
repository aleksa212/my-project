import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const router = express.Router();

/* ==================== AUTH ROUTES ==================== */

router.post("/signup", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        const exists = await User.findOne({ email });
        if (exists)
            return res.status(400).json({ message: "User already exists" });

        const hashed = await bcrypt.hash(password, 10);

        await User.create({ firstName, lastName, email, password: hashed });

        res.status(201).json({ message: "User created" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found" });

        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(400).json({ message: "Invalid password" });

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            token,
            user: { firstName: user.firstName, email: user.email }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
