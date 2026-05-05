import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* -------------------- DB -------------------- */

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Atlas connected"))
    .catch((err) => console.log("DB Error:", err));

/* -------------------- SCHEMAS -------------------- */

const LogSchema = new mongoose.Schema(
    {
        field: String,
        oldValue: String,
        newValue: String,
        changedBy: String,
        timestamp: { type: Date, default: Date.now }
    },
    { _id: false }
);

const ReservationSchema = new mongoose.Schema({
    Status: { type: String, default: "Unassigned" },

    FLTscheduled: { type: String, default: "" },
    FLTactual: { type: String, default: "" },
    VEHtype: { type: String, default: "" },
    VEHnumber: { type: String, default: "" },
    Driver: { type: String, default: "" },
    FLTstatus: { type: String, default: "" },

    Area: { type: String, required: true },
    PUlocation: { type: String, required: true },
    DOlocation: { type: String, required: true },
    PUdate: { type: Date, required: true },
    PUtime: { type: String, required: true },
    FlightNumber: { type: String, required: true },
    PAX: { type: String, required: true },
    DISPnotes: { type: String, required: true },
    TripInfo: { type: String, required: true },
    Account: { type: String, required: true },
    Price: { type: String, required: true },

    logs: [LogSchema]
});

const UserSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: { type: String, unique: true },
    password: String,

    savedFilters: [
        {
            name: String,
            airports: [String] // ["RDU", "CLT"]
        }
    ]
});

const Reservation = mongoose.model("Reservation", ReservationSchema);
const User = mongoose.model("User", UserSchema);

/* -------------------- AUTH MIDDLEWARE -------------------- */

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({ message: "No token provided" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

/* -------------------- HELPERS -------------------- */

const getChangedBy = (user) => {
    if (!user) return "unknown";

    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();

    return fullName || user.email || "unknown";
};

const createLogs = (existing, updates, user) => {
    const logs = [];

    Object.keys(updates).forEach((key) => {
        const oldVal = existing[key];
        const newVal = updates[key];

        const changed =
            newVal !== undefined &&
            String(oldVal ?? "") !== String(newVal ?? "");

        if (changed) {
            logs.push({
                field: key,
                oldValue: oldVal ?? "",
                newValue: newVal ?? "",
                changedBy: getChangedBy(user),
                timestamp: new Date()
            });
        }
    });

    return logs;
};

/* -------------------- AUTH ROUTES -------------------- */

app.post("/signup", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword
        });

        await user.save();

        res.status(201).json({ message: "User created successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ message: "Invalid password" });

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            token,
            user: {
                firstName: user.firstName,
                email: user.email
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* -------------------- RESERVATIONS -------------------- */

app.get("/reservations", async (req, res) => {
    const data = await Reservation.find();
    res.json(data);
});

app.get("/filters", auth, async (req, res) => {
    res.json(req.user.savedFilters || []);
});

app.post("/reservations", async (req, res) => {
    try {
        const reservation = new Reservation({
            Status: "Unassigned",
            ...req.body,
            PUdate: new Date(req.body.PUdate)
        });

        await reservation.save();
        res.status(201).json(reservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/filters", auth, async (req, res) => {
    try {
        const { name, airports } = req.body;

        if (!name || !airports) {
            return res.status(400).json({ message: "Missing data" });
        }

        // ✅ STEP 2: prevent duplicates
        const exists = req.user.savedFilters.find(
            f => f.name.toLowerCase() === name.toLowerCase()
        );

        if (exists) {
            return res.status(400).json({ message: "Filter name already exists" });
        }

        req.user.savedFilters.push({ name, airports });

        await req.user.save();

        res.json(req.user.savedFilters);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/reservations/:id", auth, async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ error: "Reservation not found" });
        }

        const updates = req.body;

        const logs = createLogs(reservation, updates, req.user);

        // apply updates safely
        Object.keys(updates).forEach((key) => {
            reservation[key] = updates[key];
        });

        if (logs.length) {
            reservation.logs.push(...logs);
        }

        await reservation.save();

        res.json(reservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/reservations/:id", async (req, res) => {
    try {
        await Reservation.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/filters/:name", auth, async (req, res) => {
    try {
        req.user.savedFilters = req.user.savedFilters.filter(
            f => f.name !== req.params.name
        );

        await req.user.save();

        res.json(req.user.savedFilters);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/reservations/:id/logs", async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ error: "Not found" });
        }

        res.json(reservation.logs || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* -------------------- START -------------------- */

app.listen(5000, () =>
    console.log("🚀 Server running on port 5000")
);