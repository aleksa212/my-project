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
import tripOfferRoutes from "./routes/tripOffers.js";
import { startFlightStatusPolling } from "./utils/flightStatusScheduler.js";
import { startTripOfferPolling } from "./utils/tripOfferEngine.js";

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

// Background flight-status polling — the grid always shows whatever was
// last polled, so a page refresh costs zero extra AeroAPI calls no
// matter how many dispatchers are looking at it. Each trip's own tiered
// interval (see flightStatusScheduler.js's TIERS) decides whether it's
// actually due on a given tick, down to every 5 min for trips close to
// their flight time — so this tick itself must be <= 5 min, or that
// tightest tier could never actually fire on schedule.
const FLIGHT_STATUS_POLL_INTERVAL_MS = 5 * 60 * 1000;
startFlightStatusPolling(FLIGHT_STATUS_POLL_INTERVAL_MS);

// Trip-offer polling — finds Unassigned trips as they cross into the 1h-
// before-pickup window and offers them to eligible drivers (see
// utils/tripOfferEngine.js). No driver app exists yet to actually receive
// these, but the backend half works standalone -- routes/tripOffers.js is
// what that app will call once it exists. Pure DB + candidate-lookup
// work (no external API rate limit to respect here, unlike flight
// polling), so this can run on its own cadence.
const TRIP_OFFER_POLL_INTERVAL_MS = 5 * 60 * 1000;
startTripOfferPolling(TRIP_OFFER_POLL_INTERVAL_MS);

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
     /trip-offers/mine,
     /trip-offers/:id/accept    -> tripOfferRoutes
================================================= */
app.use("/", authRoutes);
app.use("/reservations", reservationRoutes);
app.use("/filters", filterRoutes);
app.use("/drivers", driverRoutes);
app.use("/dispatch", dispatchRoutes);
app.use("/vehicles", vehicleRoutes);
app.use("/trip-offers", tripOfferRoutes);

/* ==================== START ==================== */

app.listen(5000, () =>
    console.log("🚀 Server running on port 5000")
);