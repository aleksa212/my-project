import { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider } from "ag-grid-react";

import { useReservations } from "./useReservations";
import { resolveLocation } from "./Airports";
import SelectedMenu from "./SelectedMenu";
import { columnDefs } from "./ColumnDefs";
import ReservationContextMenu from "./ReservationContextMenu";
import DispatchNotesModal from "./DispatchNotesModal";
import DispatchLogsModal from "./DispatchLogsModal";
import AutoDispatchModal from "./AutoDispatchModal";

const modules = [AllCommunityModule];
const PAGE_SIZE = 100;

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

    const safeSearchText = searchText ?? "";
    const safeIdSearch = idSearch ?? "";
    const safeSelectedDate = selectedDate ?? "";
    const safeAirportFilter = airportFilter ?? [];
    const airportFilterKey = safeAirportFilter.join(",");

    // Filtering/searching happens server-side now (see routes/
    // reservations.js), so any change to the search terms invalidates
    // whatever page you were on -- page 5 of an old, broader result set
    // isn't a meaningful place to land in a new, narrower one. Reset
    // during render (React's documented pattern for "adjusting state
    // when a prop changes") rather than in an effect, which would cost
    // an extra render-then-effect-then-rerender round trip for the exact
    // same outcome.
    const filterKey = `${safeSearchText}|${safeIdSearch}|${safeSelectedDate}|${airportFilterKey}`;
    const [page, setPage] = useState(1);
    const [lastFilterKey, setLastFilterKey] = useState(filterKey);
    if (filterKey !== lastFilterKey) {
        setLastFilterKey(filterKey);
        setPage(1);
    }

    const {
        rowData,
        setRowData,
        total,
        totalPages,
        loading,
        copyTrip,
        updateDispatchNotes,
        removeTrip
    } = useReservations({
        refreshKey,
        page,
        limit: PAGE_SIZE,
        searchText: safeSearchText,
        idSearch: safeIdSearch,
        selectedDate: safeSelectedDate,
        airportFilter: safeAirportFilter
    });

    const [gridApi, setGridApi] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [notesEditor, setNotesEditor] = useState(null);
    const [logsViewer, setLogsViewer] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [singleDispatchTrip, setSingleDispatchTrip] = useState(null);

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

    const handleRemoveReservation = async (data) => {
        const confirmRemove = window.confirm(
            `Remove trip ID ${data.tripNumber ?? "?"}? This can't be undone — its ID goes back into the pool for the next new reservation. If you just want to mark it cancelled and keep it visible, use the Cancelled status instead.`
        );
        if (!confirmRemove) return;
        await removeTrip(data);
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
                        rowData={rowData}
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
                                // Out for driver self-accept (see
                                // utils/tripOfferEngine.js) -- distinct
                                // from plain "Unassigned" so it's obvious
                                // at a glance this one's already actively
                                // being worked, not just sitting there.
                                case "Bidding": return { backgroundColor: "#9333ea", color: "#ffffff" };
                                // Covered by Uber, not the in-house fleet
                                // -- two shades of brown so "still needs
                                // to be ordered" and "already on the way"
                                // read differently at a glance.
                                case "Order Uber": return { backgroundColor: "#C19A6B" };
                                case "Uber OTW": return { backgroundColor: "#6F4E37", color: "#ffffff" };
                                // Distinct dark red from "Unassigned"'s bright
                                // red -- this means "was fine, then broke,"
                                // not "never got a driver."
                                case "needs attention": return { backgroundColor: "#7f1d1d", color: "#ffffff" };
                                // En-route progression, in the order a
                                // trip normally moves through them.
                                case "Crew called": return { backgroundColor: "#93C5FD" };
                                case "On the way": return { backgroundColor: "#C8A2C8" };
                                case "Arrived": return { backgroundColor: "#F97316", color: "#ffffff" };
                                // Terminal outcomes -- greyscale, darkest
                                // for the most final/least-recoverable one.
                                case "No show": return { backgroundColor: "#F3F4F6" };
                                case "Done": return { backgroundColor: "#D1D5DB" };
                                case "Cancelled": return { backgroundColor: "#6B7280", color: "#ffffff" };
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

                <div className="flex items-center justify-between gap-2 px-1 py-2 text-sm text-gray-600 shrink-0">
                    <span>
                        {loading
                            ? "Loading…"
                            : total === 0
                                ? "No trips"
                                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            className="px-2 py-1 border rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                        >
                            Prev
                        </button>
                        <span>Page {page} of {totalPages}</span>
                        <button
                            className="px-2 py-1 border rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                        >
                            Next
                        </button>
                    </div>
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
                    onRemove={handleRemoveReservation}
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
