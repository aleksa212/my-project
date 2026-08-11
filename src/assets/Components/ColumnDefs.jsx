import { LocationCellRenderer } from "./LocationCellRenderer";
import { DriverCellRenderer } from "./DriverCellRenderer";
import { formatLocationWithFlight, normalizeToCode } from "./Airports";

/* =============================================
   RESERVATION GRID COLUMN DEFINITIONS
   Pulled out of Table.jsx so the grid's column
   layout can be scanned/edited on its own,
   without wading through grid setup, the context
   menu, and the modals.

   This is a plain module-level constant (not a
   useState/useMemo inside Table), which is even
   more stable for ag-grid than the previous
   per-instance state was.
============================================= */
export const columnDefs = [
    {
        headerName: "",
        checkboxSelection: true,
        headerCheckboxSelection: true,
        maxWidth: 40,
        pinned: "left",
        suppressSizeToFit: true,
        resizable: false,
        sortable: false,
        filter: false,
        suppressMovable: true,
        cellClass: "checkbox-center",
        headerClass: "checkbox-center"
    },
    { field: "Status", headerName: "Status" },

    {
        field: "PUdate",
        headerName: "PU Date",
        valueFormatter: (p) => {
            if (!p.value) return "";
            const d = new Date(p.value);
            if (isNaN(d.getTime())) return "";
            // PUdate is stored as UTC midnight of the intended calendar
            // day, so it must be formatted in UTC terms — plain
            // toLocaleDateString() reads local components and shows the
            // previous day in any timezone behind UTC.
            return d.toLocaleDateString(undefined, { timeZone: "UTC" });
        }
    },

    { field: "PUtime", headerName: "PU Time", sort: "asc", maxWidth: 80 },

    {
        field: "PUlocation",
        headerName: "PU Location",
        minWidth: 200,

        valueGetter: (p) => {
            const code = p.data?.PUlocationCode;
            if (code) return code;
            return p.data?.PUlocation || "";
        },

        valueFormatter: (p) => {
            const code = p.data?.PUlocationCode;
            const raw  = p.data?.PUlocation;
            if (code) return formatLocationWithFlight(code, p.data?.FlightNumber);
            return raw || "";
        },

        cellRenderer: LocationCellRenderer,

        cellClassRules: {
            "bg-yellow-400": (p) =>
                /^[A-Z]{3}$/.test(
                    p.data?.PUlocationCode || normalizeToCode(p.data?.PUlocation)
                )
        }
    },

    {
        field: "DOlocation",
        headerName: "DO Location",
        minWidth: 200,

        valueGetter: (p) => {
            const code = p.data?.DOlocationCode;
            if (code) return code;
            return p.data?.DOlocation || "";
        },

        valueFormatter: (p) => {
            const code = p.data?.DOlocationCode;
            const raw  = p.data?.DOlocation;
            if (code) return formatLocationWithFlight(code, p.data?.FlightNumber);
            return raw || "";
        },

        cellRenderer: LocationCellRenderer,

        cellClassRules: {
            "bg-yellow-400": (p) =>
                /^[A-Z]{3}$/.test(
                    p.data?.DOlocationCode || normalizeToCode(p.data?.DOlocation)
                )
        }
    },

    { field: "FLTscheduled", headerName: "Flt Sch", maxWidth: 100 },
    {
        field: "FLTactual",
        headerName: "Flt Act",
        maxWidth: 100,
        cellStyle: (p) => {
            const puTime  = p.data?.PUtime;
            const fltAct  = p.data?.FLTactual;
            if (!puTime || !fltAct) return null;

            const toMins = (t) => {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
            };

            const diff = Math.abs(toMins(fltAct) - toMins(puTime));
            return diff > 10 ? { backgroundColor: "#ff0000", color: "#fff" } : null;
        }
    },

    {
        field: "VEHtype",
        headerName: "Veh Type",
        cellClassRules: {
            "veh-exec":    (p) => p.value === "EXEC",
            "veh-minivan": (p) => p.value?.includes("MINIVAN")
        }
    },

    { field: "VEHnumber", headerName: "Veh Number" },
    { field: "Driver", headerName: "Driver", cellRenderer: DriverCellRenderer },

    {
        field: "DISPnotes",
        headerName: "Disp Notes",
        cellRenderer: (p) => {
            const v = p.value || "";
            return v.length > 10 ? v.slice(0, 10) + "..." : v;
        },
        tooltipValueGetter: (p) => p.value
    },

    { field: "PAX",      headerName: "Pax",      maxWidth: 40 },
    { field: "TripInfo", headerName: "Trip Info" },
    { field: "FLTstatus",headerName: "Flt Status" }
];

export default columnDefs;
