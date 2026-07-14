import mongoose from "mongoose";
 
/* =============================================
   DRIVER
   Replaces the old hardcoded Drivers.jsx list.
   Each driver belongs to exactly one home
   airport and has a recurring weekly schedule
   (which days, which hours they're on shift).
 
   `displayName` is a virtual, not a stored field
   — it's always derived as "<airportCode>-<name>"
   (e.g. "PDX-John"). Two real benefits to this:
     1. It's what shows up in the UI, per the
        original ask.
     2. It doubles as a de-facto unique key once
        you have hundreds of drivers across ~50
        airports — plain first names ("John") are
        very likely to collide across airports,
        but "PDX-John" vs "LGB-John" won't.
============================================= */
const ScheduleEntrySchema = new mongoose.Schema(
    {
        day: {
            type: String,
            enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            required: true
        },
        // 24h "HH:MM", e.g. "06:00" / "18:30"
        startTime: { type: String, required: true },
        endTime: { type: String, required: true }
    },
    { _id: false }
);
 
const DriverSchema = new mongoose.Schema({
    // Base name only — the airport prefix is derived, not stored,
    // so renaming an airport code doesn't require touching every driver.
    name: { type: String, required: true },
 
    airportCode: { type: String, required: true },
 
    phone: String,
    email: String,
 
    // Recurring weekly availability. A driver can have multiple
    // entries for the same day if their shift has a split (rare,
    // but cheaper to support now than to migrate later).
    schedule: [ScheduleEntrySchema],
 
    // Soft-disable a driver (they left, they're on leave, etc.)
    // without deleting their history/logs.
    active: { type: Boolean, default: true }
});
 
DriverSchema.virtual("displayName").get(function () {
    return `${this.airportCode}-${this.name}`;
});
 
DriverSchema.set("toJSON", { virtuals: true });
DriverSchema.set("toObject", { virtuals: true });
 
export const Driver = mongoose.model("Driver", DriverSchema);
export default Driver;