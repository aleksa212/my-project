import { useState } from "react";
import { airportMap } from "./Airports";
import { useDriversContext } from "./DriversContext";

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const emptySchedule = () =>
    daysOfWeek.reduce((acc, day) => {
        acc[day] = { enabled: false, startTime: "", endTime: "" };
        return acc;
    }, {});

export default function DriversModal({ onClose }) {
    const { drivers, refreshDrivers } = useDriversContext();

    const [airportCode, setAirportCode] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [schedule, setSchedule] = useState(emptySchedule());
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [removingId, setRemovingId] = useState(null);

    const airportCodes = Object.keys(airportMap);

    const groupedDrivers = drivers.reduce((acc, d) => {
        if (!acc[d.airportCode]) acc[d.airportCode] = [];
        acc[d.airportCode].push(d);
        return acc;
    }, {});
    const sortedAirports = Object.keys(groupedDrivers).sort();

    const toggleDay = (day) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], enabled: !prev[day].enabled }
        }));
    };

    const updateDayTime = (day, field, value) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!airportCode) {
            setError("Please select an airport.");
            return;
        }
        if (!name.trim()) {
            setError("Please enter a name.");
            return;
        }

        const scheduleEntries = daysOfWeek
            .filter(day => schedule[day].enabled)
            .map(day => ({
                day,
                startTime: schedule[day].startTime,
                endTime: schedule[day].endTime
            }));

        const incomplete = scheduleEntries.some(
            entry => !entry.startTime || !entry.endTime
        );
        if (incomplete) {
            setError("Every checked day needs both a start and end time.");
            return;
        }

        setSubmitting(true);

        try {
            const token = localStorage.getItem("token");

            const res = await fetch("http://localhost:5000/drivers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: name.trim(),
                    airportCode,
                    phone,
                    email,
                    schedule: scheduleEntries
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || data.message || "Failed to add driver");
            }

            await res.json();
            refreshDrivers();

            setName("");
            setPhone("");
            setEmail("");
            setSchedule(emptySchedule());
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemove = async (driver) => {
        const confirmRemove = window.confirm(
            `Remove ${driver.displayName}? They'll no longer appear in dropdowns or be eligible for auto-dispatch. Their trip history and logs stay intact.`
        );
        if (!confirmRemove) return;

        setRemovingId(driver._id);
        setError("");

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`http://localhost:5000/drivers/${driver._id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to remove driver");
            }

            refreshDrivers();
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

                <h1 className="text-lg font-semibold mb-4">Drivers</h1>

                {/* Two independent cards — each scrolls on its own, so a
                    long working-hours form and a long driver list never
                    fight each other for space. */}
                <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto md:overflow-visible">

                    {/* ADD CARD */}
                    <div className="border rounded-lg bg-gray-50 p-4 flex flex-col md:h-full md:min-h-0">
                        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add New Driver</h2>

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
                                    <label className="text-xs text-gray-500 block mb-1">Name</label>
                                    <input
                                        type="text"
                                        className="border p-2 rounded w-full bg-white"
                                        placeholder="Driver's first name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                    {airportCode && name && (
                                        <div className="text-xs text-gray-400 mt-1">
                                            Will display as: <span className="font-medium">{airportCode}-{name}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 block mb-1">Phone (optional)</label>
                                        <input
                                            type="text"
                                            className="border p-2 rounded w-full bg-white"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 block mb-1">Email (optional)</label>
                                        <input
                                            type="email"
                                            className="border p-2 rounded w-full bg-white"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-2">Working Hours</label>
                                    <div className="flex flex-col gap-1">
                                        {daysOfWeek.map(day => (
                                            <div key={day} className="flex items-center gap-2">
                                                <label className="flex items-center gap-1 w-14 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={schedule[day].enabled}
                                                        onChange={() => toggleDay(day)}
                                                    />
                                                    {day}
                                                </label>
                                                <input
                                                    type="time"
                                                    className="border p-1 rounded text-sm bg-white"
                                                    disabled={!schedule[day].enabled}
                                                    value={schedule[day].startTime}
                                                    onChange={(e) => updateDayTime(day, "startTime", e.target.value)}
                                                />
                                                <span className="text-gray-400 text-sm">to</span>
                                                <input
                                                    type="time"
                                                    className="border p-1 rounded text-sm bg-white"
                                                    disabled={!schedule[day].enabled}
                                                    value={schedule[day].endTime}
                                                    onChange={(e) => updateDayTime(day, "endTime", e.target.value)}
                                                />
                                            </div>
                                        ))}
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
                                    {submitting ? "Adding..." : "Add Driver"}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* LIST / REMOVE CARD */}
                    <div className="border rounded-lg bg-white p-4 flex flex-col md:h-full md:min-h-0">
                        <h2 className="text-sm font-semibold text-gray-700 mb-3">Current Drivers</h2>

                        {drivers.length === 0 ? (
                            <div className="text-sm text-gray-400">No active drivers yet.</div>
                        ) : (
                            <div className="md:flex-1 md:min-h-0 md:overflow-y-auto pr-1 flex flex-col gap-4">
                                {sortedAirports.map(code => (
                                    <div key={code}>
                                        <div className="text-xs font-semibold text-gray-500 mb-1">{code}</div>
                                        <div className="flex flex-col gap-1">
                                            {groupedDrivers[code]
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map(d => (
                                                    <div
                                                        key={d._id}
                                                        className="flex items-center justify-between border rounded px-2 py-1.5 text-sm"
                                                    >
                                                        <div>
                                                            <div className="font-medium">{d.displayName}</div>
                                                            {(d.phone || d.email) && (
                                                                <div className="text-xs text-gray-400">
                                                                    {[d.phone, d.email].filter(Boolean).join(" · ")}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemove(d)}
                                                            disabled={removingId === d._id}
                                                            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50"
                                                        >
                                                            {removingId === d._id ? "Removing..." : "Remove"}
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