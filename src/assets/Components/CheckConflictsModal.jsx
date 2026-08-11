import { useState } from "react";
import { airportMap } from "./Airports";

export default function CheckConflictsModal({ onClose, onFlagged }) {
    const [airportCode, setAirportCode] = useState("");
    const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

    const [phase, setPhase] = useState("setup");
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

    const airportCodes = Object.keys(airportMap);
    const busy = phase === "loading";

    const runCheck = async () => {
        if (!airportCode) {
            setError("Select an airport first.");
            return;
        }
        setError("");
        setPhase("loading");

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("http://localhost:5000/dispatch/check-conflicts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ airportCode, date })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Check failed");

            setResult(data);
            setPhase("done");
            onFlagged?.();
        } catch (err) {
            setError(err.message);
            setPhase("setup");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />

            <div className="relative z-10 bg-white w-full max-w-2xl max-h-[85vh] p-6 rounded-lg shadow-xl flex flex-col">
                <button
                    onClick={onClose}
                    disabled={busy}
                    className="absolute top-3 right-3 text-gray-500 hover:text-black cursor-pointer text-xl font-bold disabled:opacity-30"
                >
                    ✕
                </button>

                <h1 className="text-lg font-semibold mb-1">Check for Conflicts</h1>
                <p className="text-xs text-gray-500 mb-4">
                    Re-checks every already-dispatched trip on this date against the same rules Auto
                    Dispatch uses — shift coverage, vehicle capacity, and whether the driver can
                    actually reach it from their previous drop-off. Nothing gets reassigned; anything
                    that no longer holds gets marked <strong>Needs Attention</strong> with a note, so
                    you can review it before it goes out.
                </p>

                <div className="flex items-end gap-3 mb-4">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Airport</label>
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
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Date</label>
                        <input
                            type="date"
                            className="border p-2 rounded"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            disabled={busy}
                        />
                    </div>

                    <button
                        onClick={runCheck}
                        disabled={busy}
                        className="bg-rose-700 text-white px-4 py-2 rounded hover:bg-rose-800 disabled:opacity-50"
                    >
                        {phase === "loading" ? "Checking..." : "Check for Conflicts"}
                    </button>
                </div>

                {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

                {result && (
                    <div className="flex-1 overflow-auto flex flex-col gap-4">
                        <div className="flex gap-4 text-sm">
                            <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
                                <span className="font-semibold text-red-700">{result.flagged.length}</span> trip{result.flagged.length === 1 ? "" : "s"} flagged
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-600">
                                {result.checked} dispatched trip{result.checked === 1 ? "" : "s"} checked
                            </div>
                        </div>

                        {result.flagged.length === 0 ? (
                            <div className="text-sm text-gray-500">No conflicts found — schedule holds up.</div>
                        ) : (
                            <table className="w-full text-sm border">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="text-left p-2">PU Time</th>
                                        <th className="text-left p-2">Driver</th>
                                        <th className="text-left p-2">Why</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.flagged.map(f => (
                                        <tr key={f.tripId} className="border-t align-top">
                                            <td className="p-2">{f.PUtime}</td>
                                            <td className="p-2">{f.Driver}</td>
                                            <td className="p-2 text-gray-600">
                                                <ul className="list-disc list-inside">
                                                    {f.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                                </ul>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
