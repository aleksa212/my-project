import mongoose from "mongoose";

/* =============================================
   RELEASED TRIP NUMBER
   Pool of trip numbers freed up by a cancelled
   reservation (or an abandoned "New Reservation"
   form that claimed a number and never saved).
   The next claim always draws the SMALLEST value
   here first, so gaps get filled before the
   counter grows further. findOneAndDelete is a
   single atomic operation, so two dispatchers
   claiming at the same moment can never both walk
   away with the same released number.
============================================= */
const ReleasedTripNumberSchema = new mongoose.Schema({
    tripNumber: { type: Number, required: true, unique: true }
});

export const ReleasedTripNumber = mongoose.model("ReleasedTripNumber", ReleasedTripNumberSchema);
export default ReleasedTripNumber;
