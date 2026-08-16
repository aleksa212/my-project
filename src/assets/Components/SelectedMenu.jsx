import { useEffect, useState } from "react";
import Select from "react-select";
import { useDriversContext } from "./DriversContext";
import { useVehiclesContext } from "./VehiclesContext";

// Distinct from "" (which means "dispatcher didn't touch this field" and
// gets filtered out of the save payload) — this means "explicitly clear
// this field," and DOES get sent to the backend as "".
const UNASSIGNED_VALUE = "__unassigned__";

export default function SelectedMenu({ selectedRows, setRowData, setSelectedRows, gridApi, setRefreshKey }) {
    const { drivers } = useDriversContext();
    const { vehicles, getVehicleType } = useVehiclesContext();

    const driverOptions = [
        { value: UNASSIGNED_VALUE, label: "Unassigned" },
        ...drivers.map(d => ({ value: d.displayName, label: d.displayName }))
    ];

    const vehicleOptions = [
        { value: UNASSIGNED_VALUE, label: "Unassigned" },
        ...vehicles.map(v => ({ value: v.vehicleNumber, label: v.vehicleNumber }))
    ];

    const [form, setForm] = useState({
        Status: "",
        VEHtype: "",
        VEHnumber: "",
        Driver: "",
        PUtime: ""
    });

    // Stays mounted at all times (rather than the previous early
    // `return null`) so the panel can slide in/out with a CSS
    // transition instead of popping in/out instantly -- an unmounted
    // component can't animate its own exit.
    const rows = selectedRows || [];
    const isOpen = rows.length > 0;

    useEffect(() => {
        if (rows.length === 0) return;

        setForm({
            Status: "",
            VEHtype: "",
            VEHnumber: "",
            Driver: "",
            PUtime: ""
        });
    }, [rows.length]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    // Covered by Uber instead of the in-house fleet -- no driver/vehicle
    // makes sense alongside either status, so picking one clears both
    // right in the form (the backend enforces the same thing regardless,
    // but this keeps what's about to be applied visible before Apply is
    // even clicked).
    const UBER_STATUSES = ["Order Uber", "Uber OTW"];
    const handleStatusChange = (e) => {
        const Status = e.target.value;
        setForm(prev => ({
            ...prev,
            Status,
            ...(UBER_STATUSES.includes(Status)
                ? { Driver: UNASSIGNED_VALUE, VEHnumber: UNASSIGNED_VALUE, VEHtype: "" }
                : {})
        }));
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem("token");

            // Untouched fields (still "") are dropped entirely, same as
            // before. Fields explicitly set to UNASSIGNED_VALUE pass the
            // filter and get translated to "" — an actual clear the
            // backend will apply.
            const cleanForm = Object.fromEntries(
                Object.entries(form)
                    .filter(([_, value]) => value !== "")
                    .map(([key, value]) => [key, value === UNASSIGNED_VALUE ? "" : value])
            );

            const updates = await Promise.all(
                rows.map(async (row) => {
                    const res = await fetch(`http://localhost:5000/reservations/${row._id}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify(cleanForm)
                    });
                    return res.json();
                })
            );

            setRowData((prev) =>
                prev.map((r) => {
                    const updated = updates.find((u) => u._id === r._id);
                    return updated || r;
                })
            );

            // cellStyle on Flt Act depends on BOTH PUtime and FLTactual,
            // but ag-grid only auto-redraws a cell when its OWN bound
            // value changes -- updating PUtime here doesn't touch
            // FLTactual's own value, so its red-highlight style stays
            // stale otherwise. refreshCells({force:true}) didn't clear
            // it even deferred past React's commit, so this uses
            // redrawRows instead -- a full destroy-and-rebuild of the
            // row's cell components rather than a targeted refresh,
            // which leaves no ambiguity about whether cellStyle reruns.
            setTimeout(() => {
                if (!gridApi) return;
                const ids = new Set(updates.map(u => String(u._id)));
                const rowNodes = [];
                gridApi.forEachNode(node => {
                    if (ids.has(String(node.data?._id))) rowNodes.push(node);
                });
                gridApi.redrawRows({ rowNodes });
            }, 0);
            gridApi?.deselectAll();
            setSelectedRows([]);
            // The local patch above already shows the change instantly;
            // this bumps refreshKey so useReservations re-fetches from
            // the server shortly after, as a soft refresh -- no full
            // page reload, and it catches anything the local patch
            // might have missed (e.g. another dispatcher's concurrent
            // edit) without waiting for the next unrelated remount.
            setRefreshKey?.((prev) => prev + 1);
        } catch (err) {
            console.error(err);
        }
    };

    // Per-row, unlike the shared "PU Time" field above -- each selected
    // trip's PUtime gets set to ITS OWN FLTactual (the flight's current
    // actual/estimated arrival from the FlightAware poller), not one
    // shared value across the whole selection. Rows with no FLTactual
    // yet (hotel pickups, or an airport pickup that hasn't matched a
    // flight yet) are silently skipped rather than blocking the rest.
    const matchableRows = rows.filter(r => r.FLTactual);

    const handleMatchFlightActual = async () => {
        if (matchableRows.length === 0) return;
        const token = localStorage.getItem("token");

        try {
            const updates = await Promise.all(
                matchableRows.map(async (row) => {
                    const res = await fetch(`http://localhost:5000/reservations/${row._id}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({ PUtime: row.FLTactual })
                    });
                    return res.json();
                })
            );

            setRowData((prev) =>
                prev.map((r) => {
                    const updated = updates.find((u) => u._id === r._id);
                    return updated || r;
                })
            );

            // cellStyle on Flt Act depends on BOTH PUtime and FLTactual,
            // but ag-grid only auto-redraws a cell when its OWN bound
            // value changes -- updating PUtime here doesn't touch
            // FLTactual's own value, so its red-highlight style stays
            // stale otherwise. refreshCells({force:true}) didn't clear
            // it even deferred past React's commit, so this uses
            // redrawRows instead -- a full destroy-and-rebuild of the
            // row's cell components rather than a targeted refresh,
            // which leaves no ambiguity about whether cellStyle reruns.
            setTimeout(() => {
                if (!gridApi) return;
                const ids = new Set(updates.map(u => String(u._id)));
                const rowNodes = [];
                gridApi.forEachNode(node => {
                    if (ids.has(String(node.data?._id))) rowNodes.push(node);
                });
                gridApi.redrawRows({ rowNodes });
            }, 0);
            gridApi?.deselectAll();
            setSelectedRows([]);
            // The local patch above already shows the change instantly;
            // this bumps refreshKey so useReservations re-fetches from
            // the server shortly after, as a soft refresh -- no full
            // page reload, and it catches anything the local patch
            // might have missed (e.g. another dispatcher's concurrent
            // edit) without waiting for the next unrelated remount.
            setRefreshKey?.((prev) => prev + 1);
        } catch (err) {
            console.error("Update PU time to flight actual failed:", err);
        }
    };

    const handleSwap = async () => {
        const token = localStorage.getItem("token");
        if (rows.length !== 2) return;

        const [a, b] = rows;

        const swapPayloadA = {
            VEHtype: getVehicleType(b.VEHnumber),
            VEHnumber: b.VEHnumber,
            Driver: b.Driver,
            Status: "dispatched"
        };

        const swapPayloadB = {
            VEHtype: getVehicleType(a.VEHnumber),
            VEHnumber: a.VEHnumber,
            Driver: a.Driver,
            Status: "dispatched"
        };

        try {
            const [resA, resB] = await Promise.all([
                fetch(`http://localhost:5000/reservations/${a._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify(swapPayloadA)
                }),
                fetch(`http://localhost:5000/reservations/${b._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify(swapPayloadB)
                })
            ]);

            const updatedA = await resA.json();
            const updatedB = await resB.json();

            setRowData((prev) =>
                prev.map((r) => {
                    if (r._id === updatedA._id) return updatedA;
                    if (r._id === updatedB._id) return updatedB;
                    return r;
                })
            );

            // cellStyle on Flt Act depends on BOTH PUtime and FLTactual,
            // but ag-grid only auto-redraws a cell when its OWN bound
            // value changes -- updating PUtime here doesn't touch
            // FLTactual's own value, so its red-highlight style stays
            // stale otherwise. refreshCells({force:true}) didn't clear
            // it even deferred past React's commit, so this uses
            // redrawRows instead -- a full destroy-and-rebuild of the
            // row's cell components rather than a targeted refresh,
            // which leaves no ambiguity about whether cellStyle reruns.
            setTimeout(() => {
                if (!gridApi) return;
                const ids = new Set([String(updatedA._id), String(updatedB._id)]);
                const rowNodes = [];
                gridApi.forEachNode(node => {
                    if (ids.has(String(node.data?._id))) rowNodes.push(node);
                });
                gridApi.redrawRows({ rowNodes });
            }, 0);
            gridApi?.deselectAll();
            setSelectedRows([]);
            // The local patch above already shows the change instantly;
            // this bumps refreshKey so useReservations re-fetches from
            // the server shortly after, as a soft refresh -- no full
            // page reload, and it catches anything the local patch
            // might have missed (e.g. another dispatcher's concurrent
            // edit) without waiting for the next unrelated remount.
            setRefreshKey?.((prev) => prev + 1);
        } catch (err) {
            console.error("Swap failed:", err);
        }
    };

    return (
        <div
            className={`fixed top-0 right-0 h-full w-80 bg-white shadow-xl border-l z-50 p-4 transition-transform duration-300 ease-in-out ${
                isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
            }`}
            aria-hidden={!isOpen}
        >
            <h2 className="text-lg font-semibold mb-4">Bulk Edit ({rows.length})</h2>

            <select name="Status" value={form.Status} onChange={handleStatusChange} className="border p-2 w-full mb-2">
                <option value="">Status</option>
                <option value="Unassigned">Unassigned</option>
                <option value="dispatched">Dispatched</option>
                <option value="accepted">Accepted</option>
                <option value="confirmed">Confirmed</option>
                <option value="needs attention">Needs Attention</option>
                <option value="Crew called">Crew called</option>
                <option value="On the way">On the way</option>
                <option value="Arrived">Arrived</option>
                <option value="No show">No show</option>
                <option value="Done">Done</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Order Uber">Order Uber</option>
                <option value="Uber OTW">Uber OTW</option>
            </select>

            <Select
                className="border mb-1"
                options={vehicleOptions}
                value={vehicleOptions.find(o => o.value === form.VEHnumber) || null}
                onChange={(selected) =>
                    setForm(prev => ({
                        ...prev,
                        VEHnumber: selected ? selected.value : "",
                        VEHtype: selected && selected.value !== UNASSIGNED_VALUE
                            ? getVehicleType(selected.value)
                            : ""
                    }))
                }
                placeholder="Select vehicle"
            />

            {form.VEHnumber && form.VEHnumber !== UNASSIGNED_VALUE && (
                <div className="text-xs text-gray-500 mb-2 px-1">
                    Vehicle Type: <span className="font-semibold text-gray-700">{form.VEHtype}</span>
                </div>
            )}

            <Select
                className="border mb-2"
                options={driverOptions}
                value={driverOptions.find(o => o.value === form.Driver) || null}
                onChange={(selected) =>
                    setForm(prev => ({
                        ...prev,
                        Driver: selected ? selected.value : "",
                        // Clearing the driver means this trip needs to be
                        // dispatched again — flip Status back to Unassigned
                        // so it re-enters the pool for auto-dispatch.
                        ...(selected?.value === UNASSIGNED_VALUE ? { Status: "Unassigned" } : {})
                    }))
                }
                placeholder="Select or type driver"
            />

            <div className="mb-2">
                <label className="text-xs text-gray-500 block mb-1">PU Time</label>
                <input
                    type="time"
                    name="PUtime"
                    value={form.PUtime}
                    onChange={handleChange}
                    className="border p-2 w-full"
                />
            </div>

            <button onClick={handleSave} className="bg-blue-600 text-white w-full p-2 rounded">
                Apply to {rows.length} rows
            </button>

            <button
                onClick={handleMatchFlightActual}
                disabled={matchableRows.length === 0}
                className="bg-sky-600 text-white w-full p-2 rounded mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Update PU Time to Flight Actual ({matchableRows.length})
            </button>

            {rows.length === 2 && (
                <button onClick={handleSwap} className="bg-orange-500 text-white w-full p-2 rounded mt-2">
                    Swap Drivers
                </button>
            )}
        </div>
    );
}                                                                                               