import "dotenv/config";

import express from "express";
import cors from "cors";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import reservationRoutes from "./routes/reservations.js";
import filterRoutes from "./routes/filters.js";
import driverRoutes from "./routes/Drivers.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";
import vehicleRoutes from "./routes/vehicles.js";
import { startFlightStatusPolling } from "./utils/flightStatusScheduler.js";

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

// Background flight-status polling — the grid always shows whatever was
// last polled, so a page refresh costs zero extra AeroAPI calls no
// matter how many dispatchers are looking at it. Only airports with an
// actual pending (unlanded) airport-pickup trip get polled each cycle.
// 10 min balances freshness against cost; tighten to 5 if the real
// usage against your FlightAware plan has headroom for it.
const FLIGHT_STATUS_POLL_INTERVAL_MS = 10 * 60 * 1000;
startFlightStatusPolling(FLIGHT_STATUS_POLL_INTERVAL_MS);

/* ==================== ROUTES ====================
   Mount points preserve the exact same URLs the
   frontend already calls — no frontend changes
   needed:
     /signup, /login            -> authRoutes
     /reservations, /reservations/:id, ...
                                 -> reservationRoutes
     /filters, /filters/:name   -> filterRoutes
     /drivers                   -> driverRoutes
     /dispatch/preview,
     /dispatch/commit           -> dispatchRoutes
================================================= */
app.use("/", authRoutes);
app.use("/reservations", reservationRoutes);
app.use("/filters", filterRoutes);
app.use("/drivers", driverRoutes);
app.use("/dispatch", dispatchRoutes);
app.use("/vehicles", vehicleRoutes);

/* ==================== START ==================== */

app.listen(5000, () =>
    console.log("🚀 Server running on port 5000")
);