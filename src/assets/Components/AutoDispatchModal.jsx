import { useState } from "react";
import { airportMap } from "./Airports";
import DriverRosterEditor from "./DriverRosterEditor";

export default function AutoDispatchModal({ onClose, onCommitted, singleTrip = null }) {
    const [airportCode, setAirportCode] = useState(singleTrip?.Area || "");
    const [date, setDate] = useState(() => {
        if (singleTrip?.PUdate) return new Date(singleTrip.PUdate).toISOString().split("T")[0];
        return new Date().toISOString().split("T")[0];
    });

    const [phase, setPhase] = useState("setup");
    const [plan, setPlan] = useState(null);
    const [error, setError] = useState("");

    const airportCodes = Object.keys(airportMap);
    const busy = phase === "loading" || phase === "committing";
    const isSingleTripMode = Boolean(singleTrip);

    const runPreview = async () => {
        if (!airportCode) {
            setError("Select an airport first.");
            return;
        }
        setError("");
        setPhase("loading");

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("http://localhost:5000/dispatch/preview", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    airportCode,
                    date,
                    tripIds: isSingleTripMode ? [singleTrip._id] : undefined
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Preview failed");
            }

            setPlan(await res.json());
            setPhase("preview");
        } catch (err) {
            setError(err.message);
            setPhase("setup");
        }
    };

    const commitPlan = async () => {
        if (!plan?.assigned?.length) return;

        setPhase("committing");
        setError("");

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("http://localhost:5000/dispatch/commit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    assignments: plan.assigned.map(a => ({
                        tripId: a.tripId,
                        driverName: a.driverName,
                        vehicleNumber: a.vehicleNumber,
                        tripDurationMinutes: a.tripDurationMinutes,
                        estimatedDropoff: a.estimatedDropoff
                    }))
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Commit failed");
            }

            const updatedReservations = await res.json();
            setPhase("committed");
            onCommitted?.(updatedReservations);
        } catch (err) {
            setError(err.message);
            setPhase("preview");
        }
    };

    const startOver = () => {
        setPlan(null);
        setError("");
        setPhase("setup");
    };

    const fmtDropoff = (iso) => {
        if (!iso) return "—";
        return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />

            <div className="relative z-10 bg-white w-full max-w-4xl max-h-[85vh] p-6 rounded-lg shadow-xl flex flex-col">

                <button
                    onClick={onClose}
                    disabled={busy}
                    className="absolute top-3 right-3 text-gray-500 hover:text-black cursor-pointer text-xl font-bold disabled:opacity-30"
                >
                    ✕
                </button>

                <h1 className="text-lg font-semibold mb-1">
                    {isSingleTripMode ? "Auto Dispatch This Trip" : "Auto Dispatch"}
                </h1>

                {isSingleTripMode && (
                    <p className="text-xs text-gray-500 mb-4">
                        Checking this trip ({singleTrip.PUtime}, {airportCode}) against today's
                        schedule as it currently stands — every other already-assigned trip is
                        treated as fixed.
                    </p>
                )}

                <div className="flex items-end gap-3 mb-4">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Airport</label>
                        {isSingleTripMode ? (
                            <div className="border p-2 rounded w-40 bg-gray-100 text-sm">{airportCode || "—"}</div>
                        ) : (
                            <select
                                className="border p-2 rounded w-40"
                                value={airportCode}
                                onChange={(e) => setAirportCode(e.target.value)}
                                disabled={busy}
                            >
                                <option value="">Select airport</option>
                                {airportCodes.map(code => (
                                    <option key={code} value={code}>{code}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Date</label>
                        {isSingleTripMode ? (
                            <div className="border p-2 rounded bg-gray-100 text-sm">{date}</div>
                        ) : (
                            <input
                                type="date"
                                className="border p-2 rounded"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                disabled={busy}
                            />
                        )}
                    </div>

                    <button
                        onClick={runPreview}
                        disabled={busy}
                        className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 disabled:opacity-50"
                    >
                        {phase === "loading" ? "Running..." : "Run Preview"}
                    </button>

                    {plan && !isSingleTripMode && (
                        <button
                            onClick={startOver}
                            disabled={busy}
                            className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                            Start Over
                        </button>
                    )}
                </div>

                {airportCode && date && (
                    <div className="mb-4">
                        <DriverRosterEditor airportCode={airportCode} date={date} />
                    </div>
                )}

                {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

                {plan && (
                    <div className="flex-1 overflow-auto flex flex-col gap-6">

                        <div className="flex gap-4 text-sm">
                            <div className="bg-green-50 border border-green-200 rounded px-3 py-2">
                                <span className="font-semibold text-green-700">{plan.assigned.length}</span> trip{plan.assigned.length === 1 ? "" : "s"} assigned
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
                                <span className="font-semibold text-red-700">{plan.unassigned.length}</span> could not be assigned
                            </div>
                        </div>

                        <div>
                            <div className="font-semibold mb-2">Proposed Assignments</div>
                            {plan.assigned.length === 0 ? (
                                <div className="text-sm text-gray-500">No trips could be assigned.</div>
                            ) : (
                                <table className="w-full text-sm border">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="text-left p-2">PU Time</th>
                                            <th className="text-left p-2">Location</th>
                                            <th className="text-left p-2">PAX</th>
                                            <th className="text-left p-2">Driver</th>
                                            <th className="text-left p-2">Vehicle</th>
                                            <th className="text-left p-2">Est. Dropoff</th>
                                            <th className="text-left p-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {plan.assigned.map((a) => (
                                            <tr key={a.tripId} className="border-t">
                                                <td className="p-2">{a.PUtime}</td>
                                                <td className="p-2">{a.PUlocation}</td>
                                                <td className="p-2">{a.PAX}</td>
                                                <td className="p-2">{a.driverName}</td>
                                                <td className="p-2">{a.vehicleNumber}</td>
                                                <td className="p-2">{fmtDropoff(a.estimatedDropoff)}</td>
                                                <td className="p-2 flex gap-1">
                                                    {a.vehicleSwitched && (
                                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                                            vehicle switch
                                                        </span>
                                                    )}
                                                    {a.doublePickupPartnerId && (
                                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                            double pickup
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {plan.unassigned.length > 0 && (
                            <div>
                                <div className="font-semibold mb-2 text-red-700">Not Assigned</div>
                                <table className="w-full text-sm border">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="text-left p-2">PU Time</th>
                                            <th className="text-left p-2">PU Location</th>
                                            <th className="text-left p-2">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {plan.unassigned.map(({ trip, reason }) => (
                                            <tr key={trip._id} className="border-t">
                                                <td className="p-2">{trip.PUtime}</td>
                                                <td className="p-2">{trip.PUlocationName || trip.PUlocation}</td>
                                                <td className="p-2 text-gray-600">{reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {phase !== "committed" ? (
                            <button
                                onClick={commitPlan}
                                disabled={phase === "committing" || plan.assigned.length === 0}
                                className="bg-orange-500 text-white p-2 rounded hover:bg-orange-600 disabled:opacity-50 self-start px-6"
                            >
                                {phase === "committing"
                                    ? "Dispatching..."
                                    : `Commit ${plan.assigned.length} Assignment${plan.assigned.length === 1 ? "" : "s"}`}
                            </button>
                        ) : (
                            <div className="bg-green-50 border border-green-200 rounded p-3 text-green-700 font-medium">
                                Dispatched {plan.assigned.length} trip{plan.assigned.length === 1 ? "" : "s"}. You can close this window now.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}