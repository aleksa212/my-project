import mongoose from "mongoose";

/* =============================================
   TRIP OFFER
   One document per trip that's gone into "offer"
   mode -- still Unassigned inside the offer
   window (see utils/tripOfferEngine.js), with a
   pool of drivers who are actually eligible for
   it (same schedule/feasibility rules Auto
   Dispatch itself uses). Whichever driver's app
   accepts first wins; `trip: unique` plus the
   atomic findOneAndUpdate in routes/tripOffers.js
   (conditioned on status still being "pending")
   is what makes that race-safe -- two drivers
   tapping "accept" within the same millisecond
   can never both win it.

   No driver-facing app exists yet (see
   conversation this was built from) -- this is
   the backend half only. `offers[].driver`/
   `vehicle` are exactly the driver+vehicle pairing
   that would be committed to the Reservation if
   that driver accepts, precomputed the same way
   Auto Dispatch itself would pick them.
============================================= */
const TripOfferSchema = new mongoose.Schema({
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Reservation",
        required: true,
        unique: true
    },

    offers: [
        {
            driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
            vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
            _id: false
        }
    ],

    status: {
        type: String,
        // "expired" = pickup time passed with nobody accepting;
        // "cancelled" = a dispatcher manually assigned/handled the trip
        // before any driver accepted -- kept distinct so it's clear from
        // the record alone which of those actually happened.
        enum: ["pending", "accepted", "expired", "cancelled"],
        default: "pending"
    },

    acceptedByDriver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null },
    acceptedAt: { type: Date, default: null },

    // Refreshed every poll cycle while still pending -- lets the engine
    // tell "just created" apart from "been sitting unaccepted a while"
    // without a separate createdAt lookup.
    lastOfferedAt: { type: Date, default: Date.now }
});

export const TripOffer = mongoose.model("TripOffer", TripOfferSchema);
export default TripOffer;
