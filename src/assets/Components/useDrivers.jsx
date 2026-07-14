import { useState, useEffect, useCallback } from "react";

/* =============================================
   USE DRIVERS
   Fetches real Driver records from the API,
   replacing the old static Drivers.jsx list.
   refreshDrivers() lets anything that adds/edits
   a driver (AddDriverModal) make that change show
   up everywhere else immediately.
============================================= */
export function useDrivers() {
    const [drivers, setDrivers] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const token = localStorage.getItem("token");

        fetch("http://localhost:5000/drivers", {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(setDrivers)
            .catch(console.error);
    }, [refreshKey]);

    const refreshDrivers = useCallback(() => {
        setRefreshKey(prev => prev + 1);
    }, []);

    return { drivers, refreshDrivers };
}