import { useEffect, useState } from "react";
import Select from "react-select";
import { useDriversContext } from "./DriversContext";
import { useVehiclesContext } from "./VehiclesContext";

// Distinct from "" (which means "dispatcher didn't touch this field" and
// gets filtered out of the save payload) — this means "explicitly clear
// this field," and DOES get sent to the backend as "".
const UNASSIGNED_VALUE = "__unassigned__";

export default function SelectedMenu({ selectedRows, setRowData, setSelectedRows, gridApi }) {
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

    useEffect(() => {
        if (selectedRows.length === 0) return;

        setForm({
            Status: "",
            VEHtype: "",
            VEHnumber: "",
            Driver: "",
            PUtime: ""
        });
    }, [selectedRows]);

    if (!selectedRows || selectedRows.length === 0) return null;

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
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
                selectedRows.map(async (row) => {
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

            gridApi?.deselectAll();
            setSelectedRows([]);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSwap = async () => {
        const token = localStorage.getItem("token");
        if (selectedRows.length !== 2) return;

        const [a, b] = selectedRows;

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

            gridApi?.deselectAll();
            setSelectedRows([]);
        } catch (err) {
            console.error("Swap failed:", err);
        }
    };

    return (
        <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl border-l z-50 p-4">
            <h2 className="text-lg font-semibold mb-4">Bulk Edit ({selectedRows.length})</h2>

            <select name="Status" value={form.Status} onChange={handleChange} className="border p-2 w-full mb-2">
                <option value="">Status</option>
                <option value="Unassigned">Unassigned</option>
                <option value="dispatched">Dispatched</option>
                <option value="accepted">Accepted</option>
                <option value="confirmed">Confirmed</option>
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
                Apply to {selectedRows.length} rows
            </button>

            {selectedRows.length === 2 && (
                <button onClick={handleSwap} className="bg-orange-500 text-white w-full p-2 rounded mt-2">
                    Swap Drivers
                </button>
            )}
        </div>
    );
}                                                                                               