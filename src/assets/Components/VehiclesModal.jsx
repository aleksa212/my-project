import { useState } from "react";
import { airportMap } from "./Airports";
import { useVehiclesContext } from "./VehiclesContext";

const vehicleTypes = ["EXEC", "MINIVAN"];

export default function VehiclesModal({ onClose }) {
    const { vehicles, refreshVehicles } = useVehiclesContext();

    const [airportCode, setAirportCode] = useState("");
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [type, setType] = useState("");
    const [capacity, setCapacity] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [removingId, setRemovingId] = useState(null);

    const airportCodes = Object.keys(airportMap);

    const groupedVehicles = vehicles.reduce((acc, v) => {
        if (!acc[v.airportCode]) acc[v.airportCode] = [];
        acc[v.airportCode].push(v);
        return acc;
    }, {});
    const sortedAirports = Object.keys(groupedVehicles).sort();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!airportCode) {
            setError("Please select an airport.");
            return;
        }
        if (!vehicleNumber.trim()) {
            setError("Please enter a vehicle number.");
            return;
        }
        if (!type) {
            setError("Please select a vehicle type.");
            return;
        }
        if (!capacity || Number(capacity) <= 0) {
            setError("Please enter a valid seat capacity.");
            return;
        }

        setSubmitting(true);

        try {
            const token = localStorage.getItem("token");

            const res = await fetch("http://localhost:5000/vehicles", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    vehicleNumber: vehicleNumber.trim(),
                    airportCode,
                    type,
                    capacity: Number(capacity)
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || data.message || "Failed to add vehicle");
            }

            await res.json();
            refreshVehicles();

            setVehicleNumber("");
            setType("");
            setCapacity("");
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemove = async (vehicle) => {
        const confirmRemove = window.confirm(
            `Remove ${vehicle.vehicleNumber}? It'll no longer appear in dropdowns or be eligible for auto-dispatch. Its trip history stays intact.`
        );
        if (!confirmRemove) return;

        setRemovingId(vehicle._id);
        setError("");

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`http://localhost:5000/vehicles/${vehicle._id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to remove vehicle");
            }

            refreshVehicles();
        } catch (err) {
            setError(err.message);
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            <div className="relative z-10 bg-white w-full max-w-4xl h-[85vh] rounded-lg shadow-xl flex flex-col p-6">

                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-500 hover:text-black cursor-pointer text-xl font-bold"
                >
                    ✕
                </button>

                <h1 className="text-lg font-semibold mb-4">Vehicles</h1>

                <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto md:overflow-visible">

                    {/* ADD CARD */}
                    <div className="border rounded-lg bg-gray-50 p-4 flex flex-col md:h-full md:min-h-0">
                        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add New Vehicle</h2>

                        <div className="md:flex-1 md:min-h-0 md:overflow-y-auto pr-1">
                            <form onSubmit={handleSubmit} className="flex flex-col gap-3">

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Airport</label>
                                    <select
                                        className="border p-2 rounded w-full bg-white"
                                        value={airportCode}
                                        onChange={(e) => setAirportCode(e.target.value)}
                                    >
                                        <option value="">Select airport</option>
                                        {airportCodes.map(code => (
                                            <option key={code} value={code}>{code}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Vehicle Number</label>
                                    <input
                                        type="text"
                                        className="border p-2 rounded w-full bg-white"
                                        placeholder="e.g. 673 (no airport prefix needed)"
                                        value={vehicleNumber}
                                        onChange={(e) => setVehicleNumber(e.target.value)}
                                    />
                                    {airportCode && vehicleNumber && (
                                        <div className="text-xs text-gray-400 mt-1">
                                            Will be saved as: <span className="font-medium">{airportCode}-{vehicleNumber}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 block mb-1">Type</label>
                                        <select
                                            className="border p-2 rounded w-full bg-white"
                                            value={type}
                                            onChange={(e) => setType(e.target.value)}
                                        >
                                            <option value="">Select type</option>
                                            {vehicleTypes.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 block mb-1">Capacity (seats)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="border p-2 rounded w-full bg-white"
                                            value={capacity}
                                            onChange={(e) => setCapacity(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="text-red-600 text-sm">{error}</div>
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="mt-2 bg-orange-500 text-white p-2 rounded hover:bg-orange-600 disabled:opacity-50"
                                >
                                    {submitting ? "Adding..." : "Add Vehicle"}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* LIST / REMOVE CARD */}
                    <div className="border rounded-lg bg-white p-4 flex flex-col md:h-full md:min-h-0">
                        <h2 className="text-sm font-semibold text-gray-700 mb-3">Current Vehicles</h2>

                        {vehicles.length === 0 ? (
                            <div className="text-sm text-gray-400">No active vehicles yet.</div>
                        ) : (
                            <div className="md:flex-1 md:min-h-0 md:overflow-y-auto pr-1 flex flex-col gap-4">
                                {sortedAirports.map(code => (
                                    <div key={code}>
                                        <div className="text-xs font-semibold text-gray-500 mb-1">{code}</div>
                                        <div className="flex flex-col gap-1">
                                            {groupedVehicles[code]
                                                .sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber))
                                                .map(v => (
                                                    <div
                                                        key={v._id}
                                                        className="flex items-center justify-between border rounded px-2 py-1.5 text-sm"
                                                    >
                                                        <div>
                                                            <div className="font-medium">{v.vehicleNumber}</div>
                                                            <div className="text-xs text-gray-400">
                                                                {v.type} · {v.capacity} seats
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemove(v)}
                                                            disabled={removingId === v._id}
                                                            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50"
                                                        >
                                                            {removingId === v._id ? "Removing..." : "Remove"}
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}