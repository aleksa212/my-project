import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider } from "ag-grid-react";

import { useReservations } from "./useReservations";
import { resolveLocation, formatLocationWithFlight, normalizeToCode } from "./Airports";
import { driverOptions } from "./Drivers";
import SelectedMenu from "./SelectedMenu";

const modules = [AllCommunityModule];

/* =============================================
   LOCATION CELL RENDERER
   Renders truncated text in the cell.
   On hover shows a portal tooltip with the full
   address + Copy button. Tooltip stays open as
   long as the cursor is over the cell OR the
   tooltip itself, and closes the moment it leaves
   both.
============================================= */
function LocationCellRenderer({ valueFormatted, value }) {
    const displayText = valueFormatted || value || "";

    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const [copied, setCopied] = useState(false);

    const cellRef = useRef(null);
    const inCell = useRef(false);
    const inTooltip = useRef(false);
    const closeTimer = useRef(null);

    const scheduleClose = () => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => {
            if (!inCell.current && !inTooltip.current) {
                setOpen(false);
            }
        }, 80);
    };

    const handleCellEnter = () => {
        inCell.current = true;
        clearTimeout(closeTimer.current);
        if (cellRef.current) {
            const r = cellRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + 6, left: r.left });
        }
        setOpen(true);
    };

    const handleCellLeave = () => {
        inCell.current = false;
        scheduleClose();
    };

    const handleTooltipEnter = () => {
        inTooltip.current = true;
        clearTimeout(closeTimer.current);
    };

    const handleTooltipLeave = () => {
        inTooltip.current = false;
        scheduleClose();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(displayText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    if (!displayText) return null;

    return (
        <>
            <div
                ref={cellRef}
                onMouseEnter={handleCellEnter}
                onMouseLeave={handleCellLeave}
                style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    cursor: "default",
                    height: "100%",
                    display: "flex",
                    alignItems: "center"
                }}
            >
                {displayText}
            </div>

            {open && createPortal(
                <div
                    onMouseEnter={handleTooltipEnter}
                    onMouseLeave={handleTooltipLeave}
                    style={{
                        position: "fixed",
                        top: pos.top,
                        left: pos.left,
                        zIndex: 99999,
                        background: "#fff",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.13)",
                        maxWidth: "340px",
                        fontFamily: "inherit",
                        pointerEvents: "auto"
                    }}
                >
                    {/* Header */}
                    <div style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#111827",
                        marginBottom: "6px"
                    }}>
                        Full Address:
                    </div>

                    {/* Address + Copy */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{
                            fontSize: "12px",
                            color: "#374151",
                            lineHeight: "1.5",
                            flex: 1,
                            userSelect: "text"
                        }}>
                            {displayText}
                        </span>

                        <button
                            onClick={handleCopy}
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "2px 0",
                                fontSize: "12px",
                                fontWeight: "500",
                                color: copied ? "#16a34a" : "#6b7280"
                            }}
                        >
                            {copied ? (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Copied
                                </>
                            ) : (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                    Copy
                                </>
                            )}
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

/* =============================================
   DRIVER CELL RENDERER
   Shows driver name in cell. On hover shows a
   portal card with phone (copyable) and email.
============================================= */
function DriverCellRenderer({ value }) {
    const driver = driverOptions.find(d => d.value === value);

    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const [copiedPhone, setCopiedPhone] = useState(false);
    const [copiedEmail, setCopiedEmail] = useState(false);

    const cellRef = useRef(null);
    const inCell = useRef(false);
    const inTooltip = useRef(false);
    const closeTimer = useRef(null);

    const scheduleClose = () => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => {
            if (!inCell.current && !inTooltip.current) setOpen(false);
        }, 80);
    };

    const handleCellEnter = () => {
        if (!driver) return;
        inCell.current = true;
        clearTimeout(closeTimer.current);
        if (cellRef.current) {
            const r = cellRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + 6, left: r.left });
        }
        setOpen(true);
    };

    const handleCellLeave = () => { inCell.current = false; scheduleClose(); };
    const handleTipEnter = () => { inTooltip.current = true; clearTimeout(closeTimer.current); };
    const handleTipLeave = () => { inTooltip.current = false; scheduleClose(); };

    const copyPhone = () => {
        navigator.clipboard.writeText(driver.phone);
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 1800);
    };

    const copyEmail = () => {
        navigator.clipboard.writeText(driver.email);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 1800);
    };

    if (!value) return null;

    return (
        <>
            <div
                ref={cellRef}
                onMouseEnter={handleCellEnter}
                onMouseLeave={handleCellLeave}
                style={{ height: "100%", display: "flex", alignItems: "center", cursor: "default" }}
            >
                {value}
            </div>

            {open && driver && createPortal(
                <div
                    onMouseEnter={handleTipEnter}
                    onMouseLeave={handleTipLeave}
                    style={{
                        position: "fixed",
                        top: pos.top,
                        left: pos.left,
                        zIndex: 99999,
                        background: "#fff",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.13)",
                        minWidth: "240px",
                        fontFamily: "inherit",
                        pointerEvents: "auto"
                    }}
                >
                    {/* Header */}
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
                        Contact Information:
                    </div>

                    {/* Phone */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", color: "#374151", minWidth: "60px" }}>Cellular:</span>
                        <span style={{ fontSize: "12px", color: "#374151", flex: 1 }}>{driver.phone}</span>
                        <button
                            onClick={copyPhone}
                            style={{
                                display: "flex", alignItems: "center", gap: "3px",
                                background: "none", border: "none", cursor: "pointer",
                                fontSize: "12px", fontWeight: "500",
                                color: copiedPhone ? "#16a34a" : "#6b7280",
                                padding: "2px 0"
                            }}
                        >
                            {copiedPhone ? (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                    Copied
                                </>
                            ) : (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                    Copy
                                </>
                            )}
                        </button>
                    </div>

                    {/* Email */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#374151", minWidth: "60px" }}>Email:</span>
                        <span style={{ fontSize: "12px", color: "#374151", flex: 1 }}>{driver.email}</span>
                        <button
                            onClick={copyEmail}
                            style={{
                                display: "flex", alignItems: "center", gap: "3px",
                                background: "none", border: "none", cursor: "pointer",
                                fontSize: "12px", fontWeight: "500",
                                color: copiedEmail ? "#16a34a" : "#6b7280",
                                padding: "2px 0"
                            }}
                        >
                            {copiedEmail ? (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                    Copied
                                </>
                            ) : (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                    Copy
                                </>
                            )}
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

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

    const {
        rowData,
        setRowData,
        copyTrip,
        updateDispatchNotes
    } = useReservations(refreshKey);

    const [gridApi, setGridApi] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [notesEditor, setNotesEditor] = useState(null);
    const [logsViewer, setLogsViewer] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());

    const menuRef = useRef(null);

    const safeSearchText = searchText ?? "";
    const safeIdSearch = idSearch ?? "";
    const safeSelectedDate = selectedDate ?? "";

    const filteredData = useMemo(() => {
        const matchesAirportFilter = (row) => {
            if (!airportFilter || airportFilter.length === 0) return true;
            const puCode = row.PUlocationCode || normalizeToCode(row.PUlocationCode) || null;
            const doCode = row.DOlocationCode || normalizeToCode(row.DOlocationCode) || null;
            return (
                (puCode && airportFilter.includes(puCode)) ||
                (doCode && airportFilter.includes(doCode))
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
                ${row.PUlocationCode || ""}
                ${row.DOlocationCode || ""}
                ${row.FlightNumber || ""}
            `.toLowerCase();

            const matchesText =
                safeSearchText === "" ||
                searchBlob.includes(safeSearchText.toLowerCase());

            const matchesId =
                safeIdSearch === "" ||
                String(row.id || row.ID || "").toLowerCase().includes(safeIdSearch.toLowerCase());

            const matchesDate =
                safeIdSearch !== "" ||
                safeSelectedDate === "" ||
                normalizeDate(row.PUdate) === safeSelectedDate;

            return matchesText && matchesId && matchesDate && matchesAirportFilter(row);
        });
    }, [rowData, safeSearchText, safeIdSearch, safeSelectedDate, airportFilter]);

    const [colDefs] = useState([
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
                return d.toLocaleDateString();
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
                const raw = p.data?.PUlocation;
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
                const raw = p.data?.DOlocation;
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
        { field: "FLTactual", headerName: "Flt Act", maxWidth: 100 },

        {
            field: "VEHtype",
            headerName: "Veh Type",
            cellClassRules: {
                "veh-exec": (p) => p.value === "EXEC",
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

        { field: "PAX", headerName: "Pax", maxWidth: 40 },
        { field: "TripInfo", headerName: "Trip Info" },
        { field: "FLTstatus", headerName: "Flt Status" }
    ]);

    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current?.contains(e.target)) return;
            setContextMenu(null);
        };
        window.addEventListener("mousedown", handleClick);
        return () => window.removeEventListener("mousedown", handleClick);
    }, []);

    const onGridReady = (params) => {
        setGridApi(params.api);
        params.api.sizeColumnsToFit();
    };

    const onSelectionChanged = (params) => {
        const selected = params.api.getSelectedRows();
        setSelectedRows(selected);
        setSelectedIds(new Set(selected.map(r => r._id || r.id)));
    };

    return (
        <AgGridProvider modules={modules}>
            <div
                className="ag-theme-alpine flex-1 overflow-hidden flex flex-col w-full"
                onContextMenu={(e) => {
                    if (e.target.closest(".ag-row")) e.preventDefault();
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
                            cellClass: "!text-[12px] !px-1",
                            headerClass: "!text-[12px] font-semibold !px-1"
                        }}
                        getRowStyle={(p) => {
                            switch (p.data?.Status) {
                                case "dispatched": return { backgroundColor: "#ffffff" };
                                case "accepted": return { backgroundColor: "#facc15" };
                                case "confirmed": return { backgroundColor: "#00bd19" };
                                case "Unassigned": return { backgroundColor: "#f10a0a" };
                                default: return null;
                            }
                        }}
                        onCellContextMenu={(params) => {
                            if (!params.node || !params.data) return;
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

                {contextMenu && (
                    <div
                        ref={menuRef}
                        className="absolute bg-white shadow-lg border rounded text-sm"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <div className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => {
                            setSelectedReservation(contextMenu.data);
                            setReservationOpen(true);
                            setContextMenu(null);
                        }}>
                            Edit Reservation
                        </div>

                        <div className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => {
                            const { PUlocation, DOlocation } = contextMenu.data;
                            window.open(
                                `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(resolveLocation(PUlocation))}&destination=${encodeURIComponent(resolveLocation(DOlocation))}&travelmode=driving`,
                                "_blank"
                            );
                            setContextMenu(null);
                        }}>
                            Mapping
                        </div>

                        <div className="p-2 hover:bg-red-100 text-red-600 cursor-pointer" onClick={async () => {
                            await copyTrip(contextMenu.data);
                            setContextMenu(null);
                        }}>
                            Copy trip
                        </div>

                        <div className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => {
                            setNotesEditor({ data: contextMenu.data, value: contextMenu.data.DISPnotes || "" });
                            setContextMenu(null);
                        }}>
                            Dispatch Notes
                        </div>

                        <div className="p-2 hover:bg-gray-100 cursor-pointer" onClick={async () => {
                            try {
                                const res = await fetch(`http://localhost:5000/reservations/${contextMenu.data._id}/logs`);
                                const logs = await res.json();
                                setLogsViewer({ data: contextMenu.data, logs: logs.slice().reverse() });
                            } catch {
                                setLogsViewer({ data: contextMenu.data, logs: [] });
                            }
                            setContextMenu(null);
                        }}>
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

            {notesEditor && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded shadow w-[400px]">
                        <div className="font-semibold mb-2">Edit Dispatch Notes</div>
                        <textarea
                            className="w-full border p-2 text-sm h-40"
                            value={notesEditor.value}
                            onChange={(e) => setNotesEditor(prev => ({ ...prev, value: e.target.value }))}
                        />
                        <div className="flex justify-end gap-2 mt-3">
                            <button className="px-3 py-1 bg-gray-200" onClick={() => setNotesEditor(null)}>Cancel</button>
                            <button className="px-3 py-1 bg-blue-500 text-white" onClick={async () => {
                                await updateDispatchNotes(notesEditor.data, notesEditor.value);
                                setNotesEditor(null);
                            }}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {logsViewer && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded shadow w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="font-semibold mb-2">Dispatch Logs</div>
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
                                            <td colSpan="4" className="p-3 text-center text-gray-500">No logs available</td>
                                        </tr>
                                    ) : (
                                        logsViewer.logs.map((log, i) => (
                                            <tr key={i} className="border-t">
                                                <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
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
                            <button className="px-3 py-1 bg-gray-200" onClick={() => setLogsViewer(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </AgGridProvider>
    );
}
