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

/* ==================== DB ==================== */

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Atlas connected"))
    .catch((err) => console.log("DB Error:", err));

/* ==================== AIRPORT MAP ==================== */

const airportMap = {
    PDX: "Portland International Airport, Portland, OR",
    LGB: "Long Beach Airport, Long Beach, CA",
    SNA: "John Wayne Airport (Orange County), Santa Ana, CA",
    ABQ: "Albuquerque International Sunport, Albuquerque, NM",
    FWA: "Fort Wayne International Airport, Fort Wayne, IN",
    LEX: "Blue Grass Airport, Lexington, KY",
    MDW: "Chicago Midway International Airport, Chicago, IL",
    IND: "Indianapolis International Airport, Indianapolis, IN",
    HOU: "William P. Hobby Airport, Houston, TX",
    IAH: "George Bush Intercontinental Airport, Houston, TX",
    PNS: "Pensacola International Airport, Pensacola, FL",
    VPS: "Destin–Fort Walton Beach Airport, Valparaiso, FL",
    GPT: "Gulfport–Biloxi International Airport, Gulfport, MS",
    ECP: "Northwest Florida Beaches International Airport, Panama City, FL",
    CLT: "Charlotte Douglas International Airport, Charlotte, NC",
    DTW: "Detroit Metropolitan Wayne County Airport, Detroit, MI",
    TPA: "Tampa International Airport, Tampa, FL",
    RDU: "Raleigh–Durham International Airport, Raleigh/Durham, NC",
    ORF: "Norfolk International Airport, Norfolk, VA",
    BDL: "Bradley International Airport, Windsor Locks, CT",
    JAX: "Jacksonville International Airport, Jacksonville, FL",
    JAN: "Jackson–Medgar Wiley Evers International Airport, Jackson, MS"
};

/* ==================== HELPERS ==================== */

const getAirportCode = (value) => {
    if (!value) return "";

    const input = value.trim().toUpperCase();

    // already code
    if (airportMap[input]) return input;

    // match by airport name (partial)
    const match = Object.entries(airportMap).find(([code, name]) =>
        name.toUpperCase().includes(input)
    );

    return match ? match[0] : "";
};

const getAirportName = (code) => {
    if (!code) return "";
    return airportMap[code] || "";
};

/* ==================== LOGS ==================== */

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

const getChangedBy = (user) => {
    if (!user) return "unknown";
    return (
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.email ||
        "unknown"
    );
};

const createLogs = (existing, updates, user) => {
    const logs = [];

    Object.keys(updates).forEach((key) => {
        // skip nested pricing (important)
        if (key === "pricing") return;

        const oldVal = existing[key];
        const newVal = updates[key];

        if (
            newVal !== undefined &&
            String(oldVal ?? "") !== String(newVal ?? "")
        ) {
            logs.push({
                field: key,
                oldValue: String(oldVal ?? ""),
                newValue: String(newVal ?? ""),
                changedBy: getChangedBy(user),
                timestamp: new Date()
            });
        }
    });

    return logs;
};

/* ==================== SCHEMAS ==================== */

const ReservationSchema = new mongoose.Schema({
    Status: { type: String, default: "Unassigned" },

    FLTscheduled: String,
    FLTactual: String,
    VEHtype: String,
    VEHnumber: String,
    Driver: String,
    FLTstatus: String,

    Area: String,

    PUlocation: { type: String, required: true },
    PUlocationCode: { type: String, default: "" },
    PUlocationName: { type: String, default: "" },

    DOlocation: { type: String, required: true },
    DOlocationCode: { type: String, default: "" },
    DOlocationName: { type: String, default: "" },

    PUdate: { type: Date, required: true },
    PUtime: { type: String, required: true },
    FlightNumber: { type: String, required: true },
    PAX: { type: String, required: true },
    DISPnotes: { type: String, required: true },
    TripInfo: { type: String, required: true },
    Account: { type: String, required: true },
    Price: { type: Number, required: true },
    pricing: {
        flatRate: { type: Number, default: 0 },

        perHourRate: { type: Number, default: 0 },
        perHourHours: { type: Number, default: 0 },

        travelFeeRate: { type: Number, default: 0 },
        travelFeeQty: { type: Number, default: 0 },

        waitTimeRate: { type: Number, default: 0 },
        waitTimeQty: { type: Number, default: 0 },

        extraStopRate: { type: Number, default: 0 },
        extraStopQty: { type: Number, default: 0 },

        overtime: { type: Number, default: 0 },
        gratuity: { type: Number, default: 0 },

        stdGratPercent: { type: Number, default: 0 },
        driverPercent: { type: Number, default: 0 },
        stcPercent: { type: Number, default: 0 },

        discountType: { type: String, default: "flat" },
        discountValue: { type: Number, default: 0 },

        airportFee: { type: Number, default: 0 },
        deposit: { type: Number, default: 0 }
    },

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
            airports: [String]
        }
    ]
});

const Reservation = mongoose.model("Reservation", ReservationSchema);
const User = mongoose.model("User", UserSchema);

/* ==================== AUTH ==================== */

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
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }
};

/* ==================== AUTH ROUTES ==================== */

app.post("/signup", async (req, res) => {
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

app.post("/login", async (req, res) => {
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

/* ==================== RESERVATIONS ==================== */

// GET ALL
app.get("/reservations", async (req, res) => {
    const data = await Reservation.find();
    res.json(data);
});

/* ==================== CREATE ==================== */

app.post("/reservations", async (req, res) => {
    try {
        const puCode = getAirportCode(req.body.PUlocation);
        const doCode = getAirportCode(req.body.DOlocation);

        const reservation = new Reservation({
            Status: "Unassigned",

            ...req.body,

            // only set if found
            PUlocationCode: puCode || "",
            PUlocationName: puCode ? getAirportName(puCode) : "",

            DOlocationCode: doCode || "",
            DOlocationName: doCode ? getAirportName(doCode) : "",

            PUdate: new Date(req.body.PUdate)
        });

        await reservation.save();
        res.status(201).json(reservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== UPDATE ==================== */

app.put("/reservations/:id", auth, async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ error: "Not found" });
        }

        const updates = req.body;

        // =========================
        // 1. SAFE FIELD UPDATE (NO OVERWRITES WITH UNDEFINED)
        // =========================
        const allowedFields = [
            "Status",
            "FLTscheduled",
            "FLTactual",
            "VEHtype",
            "VEHnumber",
            "Driver",
            "FLTstatus",
            "Area",
            "PUlocation",
            "DOlocation",
            "PUdate",
            "PUtime",
            "FlightNumber",
            "PAX",
            "DISPnotes",
            "TripInfo",
            "Account",
            "Price"
        ];

        const safeUpdates = {};

        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                safeUpdates[key] = updates[key];
            }
        }

        // =========================
        // 2. AIRPORT NORMALIZATION (ONLY IF PROVIDED)
        // =========================
        const puCode = updates.PUlocation
            ? getAirportCode(updates.PUlocation)
            : undefined;

        const doCode = updates.DOlocation
            ? getAirportCode(updates.DOlocation)
            : undefined;

        if (updates.PUlocation !== undefined) {
            safeUpdates.PUlocationCode = puCode || "";
            safeUpdates.PUlocationName = puCode
                ? getAirportName(puCode)
                : "";
        }

        if (updates.DOlocation !== undefined) {
            safeUpdates.DOlocationCode = doCode || "";
            safeUpdates.DOlocationName = doCode
                ? getAirportName(doCode)
                : "";
        }

        // =========================
        // 3. PRICING MERGE (SAFE NESTED UPDATE)
        // =========================
        if (updates.pricing) {
            safeUpdates.pricing = {
                ...reservation.pricing,
                ...updates.pricing
            };
        }

        // =========================
        // 4. LOGGING (ONLY REAL CHANGES)
        // =========================
        const logs = createLogs(reservation, safeUpdates, req.user);

        // =========================
        // 5. APPLY UPDATES SAFELY
        // =========================
        for (const [key, value] of Object.entries(safeUpdates)) {
            reservation[key] = value;
        }

        if (logs.length) {
            reservation.logs.push(...logs);
        }

        await reservation.save();

        res.json(reservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== DELETE ==================== */

app.delete("/reservations/:id", async (req, res) => {
    await Reservation.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

/* ==================== LOGS ==================== */

app.get("/reservations/:id/logs", async (req, res) => {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation)
        return res.status(404).json({ error: "Not found" });

    res.json(reservation.logs || []);
});

app.get("/filters", auth, async (req, res) => {
    res.json(req.user.savedFilters || []);
});

app.post("/filters", auth, async (req, res) => {
    const { name, airports } = req.body;

    req.user.savedFilters.push({
        name,
        airports
    });

    await req.user.save();

    res.json(req.user.savedFilters);
});

app.delete("/filters/:name", auth, async (req, res) => {
    req.user.savedFilters = req.user.savedFilters.filter(
        f => f.name !== req.params.name
    );

    await req.user.save();

    res.json(req.user.savedFilters);
});

/* ==================== START ==================== */

app.listen(5000, () =>
    console.log("🚀 Server running on port 5000")
);