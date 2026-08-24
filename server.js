import "dotenv/config";

import express from "express";
import cors from "cors";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import driverAuthRoutes from "./routes/driverAuth.js";
import driverTripsRoutes from "./routes/driverTrips.js";
import driverLocationRoutes from "./routes/driverLocation.js";
import reservationRoutes from "./routes/reservations.js";
import filterRoutes from "./routes/filters.js";
import driverRoutes from "./routes/Drivers.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";
import vehicleRoutes from "./routes/vehicles.js";
import { startFlightStatusPolling } from "./utils/flightStatusScheduler.js";
// Trip-offer/Bidding system disabled for now -- see the route mount and
// polling block below for why and how to turn it back on.
// import tripOfferRoutes from "./routes/tripOffers.js";
// import { startTripOfferPolling } from "./utils/tripOfferEngine.js";

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

// Trip-offer (Bidding) polling — DISABLED for now. It finds Unassigned
// trips as they cross into the 1h-before-pickup window and offers them
// to eligible drivers (see utils/tripOfferEngine.js), flipping them to
// "Bidding" -- but with no driver app to ever accept one, every offer
// just runs out the clock and lands on "needs attention" regardless,
// which is only noise while there's nothing that can act on it. The
// underlying code is untouched (model, routes, engine) -- once the
// driver app exists, uncomment the import above and these two lines to
// turn it back on.
// const TRIP_OFFER_POLL_INTERVAL_MS = 5 * 60 * 1000;
// startTripOfferPolling(TRIP_OFFER_POLL_INTERVAL_MS);

/* ==================== ROUTES ====================
   Mount points preserve the exact same URLs the
   frontend already calls — no frontend changes
   needed:
     /signup, /login            -> authRoutes (dispatcher/web login)
     /driver-auth/register,
     /driver-auth/login         -> driverAuthRoutes (driver app login)
     /driver-trips/mine         -> driverTripsRoutes (driver app trip list)
     /driver-location           -> driverLocationRoutes (driver app
                                    location ping + dispatcher map read)
     /reservations, /reservations/:id, ...
                                 -> reservationRoutes
     /filters, /filters/:name   -> filterRoutes
     /drivers                   -> driverRoutes
     /dispatch/preview,
     /dispatch/commit           -> dispatchRoutes

   /trip-offers/* is not mounted -- see the Bidding system note above.
================================================= */
app.use("/", authRoutes);
app.use("/driver-auth", driverAuthRoutes);
app.use("/driver-trips", driverTripsRoutes);
app.use("/driver-location", driverLocationRoutes);
app.use("/reservations", reservationRoutes);
app.use("/filters", filterRoutes);
app.use("/drivers", driverRoutes);
app.use("/dispatch", dispatchRoutes);
app.use("/vehicles", vehicleRoutes);
// app.use("/trip-offers", tripOfferRoutes);

/* ==================== START ==================== */

app.listen(5000, () =>
    console.log("🚀 Server running on port 5000")
);