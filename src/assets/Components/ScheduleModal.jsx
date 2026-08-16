import { useState } from "react";
import { airportMap } from "./Airports";
import DriverRosterEditor from "./DriverRosterEditor";

/**
 * Standalone driver-hours management, separate from Auto Dispatch itself
 * -- lets hours be set ahead of time (or corrected after the fact) for
 * any airport/date without needing to run a dispatch preview first. Uses
 * the exact same DriverRosterEditor (and the same PUT/DELETE day-override
 * routes) Auto Dispatch's own roster panel does, so a change made here is
 * the same data Auto Dispatch reads -- there's nothing separate to keep
 * in sync.
 */
export default function ScheduleModal({ onClose }) {
    const [airportCode, setAirportCode] = useState("");
    const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

    const airportCodes = Object.keys(airportMap);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            <div className="relative z-10 bg-white w-full max-w-2xl max-h-[85vh] p-6 rounded-lg shadow-xl flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-500 hover:text-black cursor-pointer text-xl font-bold"
                >
                    ✕
                </button>

                <h1 className="text-lg font-semibold mb-1">Schedule</h1>
                <p className="text-xs text-gray-500 mb-4">
                    Set or correct a driver's working hours for a specific airport and date. This is
                    the exact same information Auto Dispatch reads when deciding who's eligible for a
                    trip — a change made here takes effect immediately, without needing to open Auto
                    Dispatch to edit it.
                </p>

                <div className="flex items-end gap-3 mb-4">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Airport</label>
                        <select
                            className="border p-2 rounded w-40"
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
                        <label className="text-xs text-gray-500 block mb-1">Date</label>
                        <input
                            type="date"
                            className="border p-2 rounded"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                </div>

                {airportCode ? (
                    <div className="flex-1 overflow-auto">
                        <DriverRosterEditor airportCode={airportCode} date={date} />
                    </div>
                ) : (
                    <div className="text-sm text-gray-400">Select an airport to see its driver roster.</div>
                )}
            </div>
        </div>
    );
}
