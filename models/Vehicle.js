import mongoose from "mongoose";
 
/* =============================================
   VEHICLE
   Replaces the old hardcoded Vehicles.jsx list
   and the vehicleTypeMap in utils/vehicles.js.
   Each vehicle belongs to exactly one home
   airport's pool, has a type, and a capacity
   (EXECs range 9-11 depending on the specific
   vehicle, so capacity lives per-vehicle, not
   just per-type).
 
   Note: there's deliberately no "assigned driver"
   field here. Which driver has which vehicle on
   a given day is a dynamic, day-by-day decision
   (drivers keep the same vehicle across their
   trips unless there's a 2-3+ hour gap), so that
   pairing is derived from the day's Reservation
   records (Driver + VEHnumber) rather than stored
   as a fixed relationship on the vehicle itself.
============================================= */
const VehicleSchema = new mongoose.Schema({
    vehicleNumber: { type: String, required: true, unique: true },
 
    airportCode: { type: String, required: true },
 
    type: {
        type: String,
        enum: ["EXEC", "MINIVAN"],
        required: true
    },
 
    // Max passengers this specific vehicle holds.
    capacity: { type: Number, required: true },
 
    // Soft-disable a vehicle (in the shop, sold, etc.)
    // without deleting its trip history.
    active: { type: Boolean, default: true }
});
 
export const Vehicle = mongoose.model("Vehicle", VehicleSchema);
export default Vehicle;