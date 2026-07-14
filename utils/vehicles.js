import { Vehicle } from "../models/Vehicle.js";

/* =============================================
   VEHICLE TYPE LOOKUP
   Replaces the old hardcoded vehicle type map —
   type is now looked up from the real Vehicle
   collection, so any vehicle added at runtime
   (via POST /vehicles) works immediately, with
   no code change needed to "recognize" it.
============================================= */
export const getVehicleType = async (vehNumber) => {
    if (!vehNumber) return "";
    const vehicle = await Vehicle.findOne({ vehicleNumber: vehNumber });
    return vehicle ? vehicle.type : "";
};

export default getVehicleType;