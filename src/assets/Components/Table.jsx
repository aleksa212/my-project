import { useState, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider } from "ag-grid-react";

import { useReservations } from "./useReservations";
import { resolveLocation, normalizeToCode } from "./Airports";
import SelectedMenu from "./SelectedMenu";
import { columnDefs } from "./ColumnDefs";
import ReservationContextMenu from "./ReservationContextMenu";
import DispatchNotesModal from "./DispatchNotesModal";
import DispatchLogsModal from "./DispatchLogsModal";
import AutoDispatchModal from "./AutoDispatchModal";

const modules = [AllCommunityModule];

export function Table({
    searchText,
    selectedDate,
    idSearch,
    setReservationOpen,
    setSelectedReservation,
    refreshKey,
    setRefreshKey,
    airportFilter,
    setAirportFilter
}) {

    const {
        rowData,
        setRowData,
        copyTrip,
        updateDispatchNotes,
        cancelTrip
    } = useReservations(refreshKey);

    const [gridApi, setGridApi] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [notesEditor, setNotesEditor] = useState(null);
    const [logsViewer, setLogsViewer] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [singleDispatchTrip, setSingleDispatchTrip] = useState(null);

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
            const searchBlob = [
                row.Status,
                row.PUdate,
                row.PUtime,
                row.PUlocation,
                row.PUlocationCode,
                row.DOlocation,
                row.DOlocationCode,
                row.FlightNumber,
                row.FLTscheduled,
                row.FLTactual,
                row.FLTstatus,
                row.VEHtype,
                row.VEHnumber,
                row.Driver,
                row.PAX,
                row.TripInfo,
            ].filter(Boolean).join(" ").toLowerCase();

            const matchesText =
                safeSearchText === "" ||
                searchBlob.includes(safeSearchText.toLowerCase());

            const matchesId =
                safeIdSearch === "" ||
                String(row.tripNumber ?? "") === safeIdSearch;

            const matchesDate =
                safeIdSearch !== "" ||
                safeSelectedDate === "" ||
                normalizeDate(row.PUdate) === safeSelectedDate;

            return matchesText && matchesId && matchesDate && matchesAirportFilter(row);
        });
    }, [rowData, safeSearchText, safeIdSearch, safeSelectedDate, airportFilter]);

    const onGridReady = (params) => {
        setGridApi(params.api);
        params.api.sizeColumnsToFit();
    };

    const onSelectionChanged = (params) => {
        const selected = params.api.getSelectedRows();
        setSelectedRows(selected);
        setSelectedIds(new Set(selected.map(r => r._id || r.id)));
    };

    /* ==================== CONTEXT MENU ACTIONS ==================== */

    const handleEditReservation = (data) => {
        setSelectedReservation(data);
        setReservationOpen(true);
    };

    const handleMapping = (data) => {
        const { PUlocation, DOlocation } = data;
        window.open(
            `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(resolveLocation(PUlocation))}&destination=${encodeURIComponent(resolveLocation(DOlocation))}&travelmode=driving`,
            "_blank"
        );
    };

    const handleCopyTrip = async (data) => {
        const confirmCopy = window.confirm(
            `Copy trip ID ${data.tripNumber ?? "?"}? This creates a new reservation with a fresh ID and the same details.`
        );
        if (!confirmCopy) return;
        await copyTrip(data);
    };

    const handleOpenNotes = (data) => {
        setNotesEditor({ data, value: data.DISPnotes || "" });
    };

    const handleOpenLogs = async (data) => {
        try {
            const res = await fetch(`http://localhost:5000/reservations/${data._id}/logs`);
            const logs = await res.json();
            setLogsViewer({ data, logs: logs.slice().reverse() });
        } catch {
            setLogsViewer({ data, logs: [] });
        }
    };

    const handleAutoDispatchTrip = (data) => {
        const confirmDispatch = window.confirm(
            `Auto Dispatch trip ID ${data.tripNumber ?? "?"}? This will find and assign a driver for this trip.`
        );
        if (!confirmDispatch) return;
        setSingleDispatchTrip(data);
    };

    const handleCancelReservation = async (data) => {
        const confirmCancel = window.confirm(
            `Cancel trip ID ${data.tripNumber ?? "?"}? This can't be undone — its ID goes back into the pool for the next new reservation.`
        );
        if (!confirmCancel) return;
        await cancelTrip(data);
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
                        columnDefs={columnDefs}
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
                                // Distinct dark red from "Unassigned"'s bright
                                // red -- this means "was fine, then broke,"
                                // not "never got a driver."
                                case "needs attention": return { backgroundColor: "#7f1d1d", color: "#ffffff" };
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

                <ReservationContextMenu
                    contextMenu={contextMenu}
                    onClose={() => setContextMenu(null)}
                    onEdit={handleEditReservation}
                    onMap={handleMapping}
                    onCopyTrip={handleCopyTrip}
                    onNotes={handleOpenNotes}
                    onLogs={handleOpenLogs}
                    onAutoDispatch={handleAutoDispatchTrip}
                    onCancel={handleCancelReservation}
                />

                <SelectedMenu
                    selectedRows={selectedRows}
                    setRowData={setRowData}
                    setSelectedRows={setSelectedRows}
                    gridApi={gridApi}
                    setRefreshKey={setRefreshKey}
                />
            </div>

            <DispatchNotesModal
                notesEditor={notesEditor}
                setNotesEditor={setNotesEditor}
                onSave={updateDispatchNotes}
            />

            <DispatchLogsModal
                logsViewer={logsViewer}
                onClose={() => setLogsViewer(null)}
            />

            {singleDispatchTrip && (
                <AutoDispatchModal
                    singleTrip={singleDispatchTrip}
                    onClose={() => setSingleDispatchTrip(null)}
                    onCommitted={(updatedReservations) => {
                        setRowData(prev =>
                            prev.map(r => {
                                const updated = updatedReservations.find(
                                    u => (u._id || u.id) === (r._id || r.id)
                                );
                                return updated || r;
                            })
                        );
                    }}
                />
            )}
        </AgGridProvider>
    );
}

export default Table;
