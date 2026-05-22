import { useEffect, useState } from "react";
import Select from "react-select";
import { vehicleOptions } from "./Vehicles";
import { driverOptions } from "./Drivers";

export default function SelectedMenu({ selectedRows, setRowData, setSelectedRows, gridApi }) {
    const [form, setForm] = useState({
        Status: "",
        VEHtype: "",
        VEHnumber: "",
        Driver: ""
    });

    // reset form when selection changes
    useEffect(() => {
        if (selectedRows.length === 0) return;

        setForm({
            Status: "",
            VEHtype: "",
            VEHnumber: "",
            Driver: ""
        });
    }, [selectedRows]);

    if (!selectedRows || selectedRows.length === 0) return null;

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem("token");
            const cleanForm = Object.fromEntries(
                Object.entries(form).filter(([_, value]) => value !== "")
            );

            const updates = await Promise.all(
                selectedRows.map(async (row) => {
                    const res = await fetch(
                        `http://localhost:5000/reservations/${row._id}`,
                        {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`
                            },
                            body: JSON.stringify(cleanForm)
                        }
                    );

                    return res.json();
                })
            );

            setRowData((prev) =>
                prev.map((r) => {
                    const updated = updates.find((u) => u._id === r._id);
                    return updated || r;
                })
            );

            // 🔥 CRITICAL ORDER (important)
            gridApi?.deselectAll();

            // force React sync immediately
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
            VEHtype: b.VEHtype,
            VEHnumber: b.VEHnumber,
            Driver: b.Driver,
            Status: "dispatched"
        };

        const swapPayloadB = {
            VEHtype: a.VEHtype,
            VEHnumber: a.VEHnumber,
            Driver: a.Driver,
            Status: "dispatched"
        };

        try {
            const [resA, resB] = await Promise.all([
                fetch(`http://localhost:5000/reservations/${a._id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(swapPayloadA)
                }),
                fetch(`http://localhost:5000/reservations/${b._id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
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
            <h2 className="text-lg font-semibold mb-4">
                Bulk Edit ({selectedRows.length})
            </h2>

            {/* Status */}
            <select
                name="Status"
                value={form.Status}
                onChange={handleChange}
                className="border p-2 w-full mb-2"
            >
                <option value="">Status</option>
                <option value="Unassigned">Unassigned</option>
                <option value="dispatched">Dispatched</option>
                <option value="accepted">Accepted</option>
                <option value="confirmed">Confirmed</option>
            </select>

            {/* VEH type */}
            <select
                name="VEHtype"
                value={form.VEHtype}
                onChange={handleChange}
                className="border p-2 w-full mb-2"
            >
                <option value="">Vehicle Type</option>
                <option value="EXEC">EXEC</option>
                <option value="MINIVAN">MINIVAN</option>
            </select>

            {/* VEH number */}
            <Select
                className="border mb-2"
                options={vehicleOptions}
                value={vehicleOptions.find(o => o.value === form.VEHnumber) || null}
                onChange={(selected) =>
                    setForm(prev => ({
                        ...prev,
                        VEHnumber: selected ? selected.value : ""
                    }))
                }
                isClearable
                placeholder="Select or type vehicle"
            />

            {/* Driver */}
            <Select
                className="border mb-2"
                options={driverOptions}
                value={driverOptions.find(o => o.value === form.Driver) || null}
                onChange={(selected) =>
                    setForm(prev => ({
                        ...prev,
                        Driver: selected ? selected.value : ""
                    }))
                }
                isClearable
                placeholder="Select or type driver"
            />

            <button
                onClick={handleSave}
                className="bg-blue-600 text-white w-full p-2 rounded"
            >
                Apply to {selectedRows.length} rows
            </button>

            {selectedRows.length === 2 && (
                <button
                    onClick={handleSwap}
                    className="bg-orange-500 text-white w-full p-2 rounded mt-2"
                >
                    Swap Drivers
                </button>
            )}
        </div>
    );
}