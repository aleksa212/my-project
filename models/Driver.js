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
    // unique+sparse rather than a hard unique -- a driver added by a
    // dispatcher with no email yet shouldn't collide with every other
    // email-less driver, but two drivers can't share one once set. This
    // is also now the driver app's login identifier (see
    // routes/driverAuth.js), which is the actual reason uniqueness
    // matters here.
    email: { type: String, default: "", unique: true, sparse: true },

    // Only ever set by the driver themselves via the driver app's
    // register flow (routes/driverAuth.js) -- a dispatcher creating a
    // driver through the web app's Drivers management never sets this.
    // `select: false` keeps the hash out of every normal Driver query
    // (e.g. the web app's driver list) so it's never accidentally sent
    // to a client that has no business seeing it.
    password: { type: String, default: null, select: false },

    // Recurring weekly availability. A driver can have multiple
    // entries for the same day if their shift has a split (rare,
    // but cheaper to support now than to migrate later).
    schedule: [ScheduleEntrySchema],
 
    // Soft-disable a driver (they left, they're on leave, etc.)
    // without deleting their history/logs.
    active: { type: Boolean, default: true },

    // Latest known position from the driver app's background location
    // ping (see routes/driverLocation.js) -- just the last point, not a
    // history/track log, since the dispatcher map only needs to show
    // where a driver is right now. `updatedAt` lets the map (and the
    // GET endpoint) tell a live position apart from a stale one, e.g. a
    // driver whose phone died or who force-quit the app hours ago.
    location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        updatedAt: { type: Date, default: null }
    }
});
 
DriverSchema.virtual("displayName").get(function () {
    return `${this.airportCode}-${this.name}`;
});
 
DriverSchema.set("toJSON", { virtuals: true });
DriverSchema.set("toObject", { virtuals: true });
 
export const Driver = mongoose.model("Driver", DriverSchema);
export default Driver;