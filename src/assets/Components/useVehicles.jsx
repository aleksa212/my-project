import { useState, useEffect, useCallback } from "react";

/* =============================================
   USE VEHICLES
   Fetches real Vehicle records from the API,
   replacing the old static Vehicles.jsx list.
============================================= */
export function useVehicles() {
    const [vehicles, setVehicles] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const token = localStorage.getItem("token");

        fetch("http://localhost:5000/vehicles", {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(setVehicles)
            .catch(console.error);
    }, [refreshKey]);

    const refreshVehicles = useCallback(() => {
        setRefreshKey(prev => prev + 1);
    }, []);

    const getVehicleType = useCallback(
        (vehNumber) => {
            if (!vehNumber) return "";
            const vehicle = vehicles.find(v => v.vehicleNumber === vehNumber);
            return vehicle ? vehicle.type : "";
        },
        [vehicles]
    );

    return { vehicles, refreshVehicles, getVehicleType };
}