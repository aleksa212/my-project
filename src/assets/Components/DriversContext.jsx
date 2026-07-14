import { createContext, useContext } from "react";
import { useDrivers } from "./useDrivers";

/* =============================================
   DRIVERS CONTEXT
   DriverCellRenderer is mounted by ag-grid itself,
   not rendered directly in Table.jsx's JSX — so it
   can't receive live driver data as a normal prop
   without turning ColumnDefs into a per-render
   function (deliberately avoided per the comment
   at the top of ColumnDefs.jsx). Context solves
   this: anything under <DriversProvider>, including
   ag-grid's portaled cell renderers, can read the
   live list directly.
============================================= */
const DriversContext = createContext({ drivers: [], refreshDrivers: () => { } });

export function DriversProvider({ children }) {
    const value = useDrivers();
    return (
        <DriversContext.Provider value={value}>
            {children}
        </DriversContext.Provider>
    );
}

export function useDriversContext() {
    return useContext(DriversContext);
}