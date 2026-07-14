import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import reservationRoutes from "./routes/reservations.js";
import filterRoutes from "./routes/filters.js";
import driverRoutes from "./routes/Drivers.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";
import vehicleRoutes from "./routes/vehicles.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

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