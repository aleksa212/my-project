import mongoose from "mongoose";

/* =============================================
   TRIP COUNTER
   Singleton document holding the highest trip
   number ever issued. $inc on a single document
   is atomic in MongoDB, so concurrent claims from
   different dispatchers can never land on the same
   number — each request gets a strictly unique,
   strictly increasing value.
============================================= */
const TripCounterSchema = new mongoose.Schema({
    _id: { type: String, default: "tripNumber" },
    value: { type: Number, default: 0 }
});

export const TripCounter = mongoose.model("TripCounter", TripCounterSchema);
export default TripCounter;
