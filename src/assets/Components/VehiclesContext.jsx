import { createContext, useContext } from "react";
import { useVehicles } from "./useVehicles";

const VehiclesContext = createContext({
    vehicles: [],
    refreshVehicles: () => {},
    getVehicleType: () => ""
});

export function VehiclesProvider({ children }) {
    const value = useVehicles();
    return (
        <VehiclesContext.Provider value={value}>
            {children}
        </VehiclesContext.Provider>
    );
}

export function useVehiclesContext() {
    return useContext(VehiclesContext);
}