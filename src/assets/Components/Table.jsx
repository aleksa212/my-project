import { useState, useMemo, useEffect, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider } from "ag-grid-react";

import { useReservations } from "./useReservations";
import { resolveLocation, formatLocationWithFlight } from "./Airports";
import SelectedMenu from "./SelectedMenu";

const modules = [AllCommunityModule];

export function Table({
    searchText,
    selectedDate,
    idSearch,
    setReservationOpen,
    setSelectedReservation,
    refreshKey,
    airportFilter,
    setAirportFilter
}) {

    // ======================
    // DATA LAYER (HOOK)
    // ======================
    const {
        rowData,
        setRowData,
        copyTrip,
        updateDispatchNotes
    } = useReservations(refreshKey);

    // ======================
    // LOCAL STATE
    // ======================
    const [gridApi, setGridApi] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [notesEditor, setNotesEditor] = useState(null);
    const [logsViewer, setLogsViewer] = useState(null);

    const [selectedIds, setSelectedIds] = useState(new Set());

    const menuRef = useRef(null);

    // ======================
    // SAFE VALUES
    // ======================
    const safeSearchText = searchText ?? "";
    const safeIdSearch = idSearch ?? "";
    const safeSelectedDate = selectedDate ?? "";

    // ======================
    // FILTERED DATA
    // ======================
    const filteredData = useMemo(() => {
        const matchesAirportFilter = (row) => {
            if (airportFilter.length === 0) return true;

            const puCode = row.PUlocation?.slice(0, 3);
            const doCode = row.DOlocation?.slice(0, 3);

            return (
                airportFilter.includes(puCode) ||
                airportFilter.includes(doCode)
            );
        };

        const normalizeDate = (dateStr) => {
            if (!dateStr) return "";
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return "";
            return d.toISOString().slice(0, 10);
        };

        return rowData.filter((row) => {
            const searchBlob = `
                    ${Object.values(row).join(" ")}
                    ${formatLocationWithFlight(row.PUlocation, row.FlightNumber)}
                    ${formatLocationWithFlight(row.DOlocation, row.FlightNumber)}
                `.toLowerCase();

            const matchesText =
                safeSearchText === "" ||
                searchBlob.includes(safeSearchText.toLowerCase());

            const matchesId =
                safeIdSearch === "" ||
                String(row.id || row.ID || "")
                    .toLowerCase()
                    .includes(safeIdSearch.toLowerCase());

            const matchesDate =
                safeIdSearch !== "" ||
                safeSelectedDate === "" ||
                normalizeDate(row.PUdate) === safeSelectedDate;

            return matchesText && matchesId && matchesDate && matchesAirportFilter(row);
        });
    }, [rowData, safeSearchText, safeIdSearch, safeSelectedDate, airportFilter]);

    // ======================
    // COLUMN DEFS
    // ======================
    const [colDefs] = useState([
        {
            headerName: "",
            checkboxSelection: true,
            headerCheckboxSelection: true,
            width: 30,
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
            valueFormatter: (params) => {
                if (!params.value) return "";
                const d = new Date(params.value);
                if (isNaN(d.getTime())) return "";
                return d.toLocaleDateString();
            }
        },

        { field: "PUtime", headerName: "PU Time", sort: "asc" },

        {
            field: "PUlocation",
            headerName: "PU Location",
            wrapText: true,
            autoHeight: true,
            minWidth: 250,
            valueFormatter: (p) =>
                formatLocationWithFlight(p.value, p.data?.FlightNumber),
            cellClassRules: {
                "bg-yellow-400": (p) => /^[A-Z]{3}$/.test(p.value)
            }
        },

        {
            field: "DOlocation",
            headerName: "DO Location",
            wrapText: true,
            autoHeight: true,
            minWidth: 250,
            valueFormatter: (p) =>
                formatLocationWithFlight(p.value, p.data?.FlightNumber),
            cellClassRules: {
                "bg-yellow-400": (p) => /^[A-Z]{3}$/.test(p.value)
            }
        },

        { field: "FLTscheduled", headerName: "Flt Scheduled" },
        { field: "FLTactual", headerName: "Flt Actual" },

        {
            field: "VEHtype",
            headerName: "Veh Type",
            cellClassRules: {
                "veh-exec": (p) => p.value === "EXEC",
                "veh-minivan": (p) => p.value?.includes("MINIVAN")
            }
        },

        { field: "VEHnumber", headerName: "Veh Number" },
        { field: "Driver", headerName: "Driver" },

        {
            field: "DISPnotes",
            headerName: "Disp Notes",
            cellRenderer: (p) => {
                const v = p.value || "";
                return v.length > 10 ? v.slice(0, 10) + "..." : v;
            },
            tooltipValueGetter: (p) => p.value
        },

        { field: "PAX", headerName: "PAX" },
        { field: "TripInfo", headerName: "Trip Info" },
        { field: "FLTstatus", headerName: "Flt Status" }
    ]);

    // ======================
    // CLOSE MENU OUTSIDE CLICK
    // ======================
    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current?.contains(e.target)) return;
            setContextMenu(null);
        };

        window.addEventListener("mousedown", handleClick);
        return () => window.removeEventListener("mousedown", handleClick);
    }, []);

    // ======================
    // GRID READY
    // ======================
    const onGridReady = (params) => {
        setGridApi(params.api);
        params.api.sizeColumnsToFit();
    };

    // ======================
    // ROW SELECTION
    // ======================
    const onSelectionChanged = (params) => {
        const selected = params.api.getSelectedRows();

        setSelectedRows(selected);

        setSelectedIds(
            new Set(selected.map(r => r._id || r.id))
        );
    };

    return (
        <AgGridProvider modules={modules}>
            <div
                className="ag-theme-alpine [height:calc(100vh-44px)] w-full overflow-hidden flex flex-col"
                onContextMenu={(e) => {
                    // only block inside grid rows
                    if (e.target.closest(".ag-row")) {
                        e.preventDefault();
                    }
                }}
            >
                <div className="flex-1 min-h-0 min-w-0 w-full">
                    <AgGridReact
                        rowData={filteredData}
                        columnDefs={colDefs}
                        rowClassRules={{
                            "row-dim": (params) => {
                                if (selectedIds.size === 0) return false;
                                const id = params.data?._id || params.data?.id;
                                return !selectedIds.has(id);
                            }
                        }}
                        getRowId={(p) => p.data._id || p.data.id}
                        rowSelection="multiple"
                        onSelectionChanged={onSelectionChanged}
                        suppressContextMenu={true}
                        onGridReady={onGridReady}
                        tooltipShowDelay={0}
                        defaultColDef={{
                            flex: 0,
                            minWidth: 80,
                            autoHeight: true,
                            cellClass: "!text-[12px] !px-1",
                            headerClass: "!text-[16px] font-semibold !px-0"
                        }}
                        getRowStyle={(p) => {
                            switch (p.data?.Status) {
                                case "dispatched":
                                    return { backgroundColor: "#ffffff" };
                                case "accepted":
                                    return { backgroundColor: "#facc15" };
                                case "confirmed":
                                    return { backgroundColor: "#00bd19" };
                                case "Unassigned":
                                    return { backgroundColor: "#f10a0a" };
                                default:
                                    return null;
                            }
                        }}
                        onCellContextMenu={(params) => {
                            if (!params.node || !params.data) return;

                            // 🔥 THIS is the key fix
                            params.event.preventDefault?.();
                            params.event.stopPropagation?.();

                            setContextMenu({
                                x: params.event.clientX,
                                y: params.event.clientY,
                                data: params.data
                            });
                        }}
                    />
                </div>

                {/* ======================
                    CONTEXT MENU
                ====================== */}
                {contextMenu && (
                    <div
                        ref={menuRef}
                        className="absolute bg-white shadow-lg border rounded text-sm"
                        style={{
                            top: contextMenu.y,
                            left: contextMenu.x
                        }}
                    >
                        <div
                            className="p-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                                setSelectedReservation(contextMenu.data);
                                setReservationOpen(true);
                                setContextMenu(null);
                            }}
                        >
                            Edit Reservation
                        </div>

                        <div
                            className="p-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                                const { PUlocation, DOlocation } =
                                    contextMenu.data;

                                const origin = encodeURIComponent(
                                    resolveLocation(PUlocation)
                                );
                                const destination = encodeURIComponent(
                                    resolveLocation(DOlocation)
                                );

                                window.open(
                                    `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`,
                                    "_blank"
                                );

                                setContextMenu(null);
                            }}
                        >
                            Mapping
                        </div>

                        <div
                            className="p-2 hover:bg-red-100 text-red-600 cursor-pointer"
                            onClick={async () => {
                                await copyTrip(contextMenu.data);
                                setContextMenu(null);
                            }}
                        >
                            Copy trip
                        </div>

                        <div
                            className="p-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                                setNotesEditor({
                                    data: contextMenu.data,
                                    value: contextMenu.data.DISPnotes || ""
                                });
                                setContextMenu(null);
                            }}
                        >
                            Dispatch Notes
                        </div>
                        <div
                            className="p-2 hover:bg-gray-100 cursor-pointer"
                            onClick={async () => {
                                try {
                                    const res = await fetch(
                                        `http://localhost:5000/reservations/${contextMenu.data._id}/logs`
                                    );

                                    const logs = await res.json();

                                    setLogsViewer({
                                        data: contextMenu.data,
                                        logs: logs.slice().reverse()
                                    });

                                } catch (err) {
                                    console.error("Failed to fetch logs", err);

                                    setLogsViewer({
                                        data: contextMenu.data,
                                        logs: []
                                    });
                                }

                                setContextMenu(null);
                            }}
                        >
                            Dispatch Logs
                        </div>
                    </div>
                )}

                <SelectedMenu
                    selectedRows={selectedRows}
                    setRowData={setRowData}
                    setSelectedRows={setSelectedRows}
                    gridApi={gridApi}
                />
            </div>

            {/* ======================
                NOTES MODAL
            ====================== */}
            {notesEditor && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded shadow w-[400px]">
                        <div className="font-semibold mb-2">
                            Edit Dispatch Notes
                        </div>

                        <textarea
                            className="w-full border p-2 text-sm h-40"
                            value={notesEditor.value}
                            onChange={(e) =>
                                setNotesEditor((prev) => ({
                                    ...prev,
                                    value: e.target.value
                                }))
                            }
                        />

                        <div className="flex justify-end gap-2 mt-3">
                            <button
                                className="px-3 py-1 bg-gray-200"
                                onClick={() => setNotesEditor(null)}
                            >
                                Cancel
                            </button>

                            <button
                                className="px-3 py-1 bg-blue-500 text-white"
                                onClick={async () => {
                                    await updateDispatchNotes(
                                        notesEditor.data,
                                        notesEditor.value
                                    );
                                    setNotesEditor(null);
                                }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {logsViewer && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded shadow w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="font-semibold mb-2">
                            Dispatch Logs
                        </div>

                        <div className="flex-1 overflow-auto border">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="text-left p-2">Date/Time</th>
                                        <th className="text-left p-2">Field</th>
                                        <th className="text-left p-2">Old</th>
                                        <th className="text-left p-2">New</th>
                                        <th className="text-left p-2">Changed By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logsViewer.logs.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="p-3 text-center text-gray-500">
                                                No logs available
                                            </td>
                                        </tr>
                                    ) : (
                                        logsViewer.logs.map((log, i) => (
                                            <tr key={i} className="border-t">
                                                <td className="p-2">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </td>
                                                <td className="p-2">{log.field}</td>
                                                <td className="p-2">{log.oldValue}</td>
                                                <td className="p-2">{log.newValue}</td>
                                                <td className="p-2">{log.changedBy}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end mt-3">
                            <button
                                className="px-3 py-1 bg-gray-200"
                                onClick={() => setLogsViewer(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AgGridProvider>
    );
}