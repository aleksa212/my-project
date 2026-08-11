import mongoose from "mongoose";

/* =============================================
   DRIVER DAY OVERRIDE
   A one-off exception to a driver's recurring
   weekly `schedule`, scoped to a single calendar
   date. Two independent things it can express:
     - available: false  -> driver called out,
       excluded from that date's auto-dispatch
       entirely, regardless of their default shift.
     - startTime/endTime -> driver is working that
       date but not their usual hours (e.g. covering
       a shorter shift). Leaving these blank falls
       back to whatever their default schedule says
       for that weekday.
   Kept as its own collection (rather than an
   array on Driver) since these are transient,
   date-scoped facts rather than part of the
   driver's standing profile.
============================================= */
const DriverDayOverrideSchema = new mongoose.Schema({
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },

    // "YYYY-MM-DD"
    date: { type: String, required: true },

    available: { type: Boolean, default: true },

    // 24h "HH:MM". Blank means "use the default schedule's hours".
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" }
});

DriverDayOverrideSchema.index({ driver: 1, date: 1 }, { unique: true });

export const DriverDayOverride = mongoose.model("DriverDayOverride", DriverDayOverrideSchema);
export default DriverDayOverride;
