import mongoose from "mongoose";

/* =============================================
   FLIGHTAWARE USAGE
   Singleton document tracking AeroAPI calls made
   this calendar month, so a hard monthly cap can
   be enforced without trusting FlightAware's own
   billing/alerts (their account has no usage-alert
   feature — only community-forum notifications).
   One document incremented per actual HTTP request
   to AeroAPI (each page fetched is one billable
   "result set"), reset whenever the month rolls
   over. See utils/flightAware.js.
============================================= */
const FlightAwareUsageSchema = new mongoose.Schema({
    _id: { type: String, default: "flightAwareUsage" },
    month: { type: String, required: true }, // "YYYY-MM"
    count: { type: Number, default: 0 }
});

export const FlightAwareUsage = mongoose.model("FlightAwareUsage", FlightAwareUsageSchema);
export default FlightAwareUsage;
