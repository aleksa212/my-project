import { useEffect, useState } from "react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Matches the backend's UTC-based weekday read on a plain "YYYY-MM-DD"
// string (see combineDateTime's comment in autoDispatch.js) — a date
// input's value has no time-of-day component, so this must stay in UTC
// terms to land on the same weekday the dispatch engine will use.
const weekdayFor = (dateStr) => DAY_NAMES[new Date(dateStr).getUTCDay()];

/**
 * One airport/date's driver roster, with each driver's effective shift
 * (default weekly schedule, or a one-off override for this exact date)
 * editable inline. Shared between AutoDispatchModal (where it doubles as
 * a "does this driver's schedule look right before I dispatch" check)
 * and ScheduleModal (a standalone place to manage hours ahead of time,
 * without needing to run a dispatch preview first) — same data, same
 * PUT/DELETE day-override routes, so there's exactly one place this
 * logic can drift.
 */
export default function DriverRosterEditor({ airportCode, date }) {
    const [roster, setRoster] = useState([]);
    const [overridesByDriverId, setOverridesByDriverId] = useState({});
    const [rosterLoading, setRosterLoading] = useState(false);
    const [rosterError, setRosterError] = useState("");
    const [savingDriverId, setSavingDriverId] = useState(null);

    useEffect(() => {
        if (!airportCode || !date) {
            setRoster([]);
            setOverridesByDriverId({});
            return;
        }

        let cancelled = false;
        setRosterLoading(true);
        setRosterError("");

        const token = localStorage.getItem("token");
        Promise.all([
            fetch(`http://localhost:5000/drivers?airportCode=${airportCode}`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`http://localhost:5000/drivers/day-overrides?airportCode=${airportCode}&date=${date}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        ])
            .then(async ([driversRes, overridesRes]) => {
                if (!driversRes.ok || !overridesRes.ok) {
                    throw new Error("Failed to load that day's driver roster");
                }
                const drivers = await driversRes.json();
                const overrides = await overridesRes.json();
                if (cancelled) return;

                setRoster(drivers);
                setOverridesByDriverId(
                    Object.fromEntries(overrides.map(o => [o.driver, o]))
                );
            })
            .catch(err => {
                if (!cancelled) setRosterError(err.message);
            })
            .finally(() => {
                if (!cancelled) setRosterLoading(false);
            });

        return () => { cancelled = true; };
    }, [airportCode, date]);

    const effectiveShift = (driver) => {
        const override = overridesByDriverId[driver._id];
        const defaultShift = driver.schedule.find(s => s.day === weekdayFor(date));
        const worksByDefault = Boolean(defaultShift);
        return {
            available: override ? override.available !== false : worksByDefault,
            startTime: override?.startTime || defaultShift?.startTime || "",
            endTime: override?.endTime || defaultShift?.endTime || "",
            worksByDefault,
            hasOverride: Boolean(override)
        };
    };

    const saveOverride = async (driverId, patch) => {
        const current = effectiveShift(roster.find(d => d._id === driverId));
        setSavingDriverId(driverId);
        setRosterError("");

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`http://localhost:5000/drivers/${driverId}/day-override`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    date,
                    available: current.available,
                    startTime: current.startTime,
                    endTime: current.endTime,
                    ...patch
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save driver availability");
            }

            const saved = await res.json();
            setOverridesByDriverId(prev => ({ ...prev, [driverId]: saved }));
        } catch (err) {
            setRosterError(err.message);
        } finally {
            setSavingDriverId(null);
        }
    };

    const clearOverride = async (driverId) => {
        setSavingDriverId(driverId);
        setRosterError("");

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(
                `http://localhost:5000/drivers/${driverId}/day-override?date=${date}`,
                { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to reset driver availability");
            }

            setOverridesByDriverId(prev => {
                const next = { ...prev };
                delete next[driverId];
                return next;
            });
        } catch (err) {
            setRosterError(err.message);
        } finally {
            setSavingDriverId(null);
        }
    };

    if (!airportCode || !date) return null;

    return (
        <div className="border rounded-lg">
            <div className="px-3 py-2 border-b bg-gray-50 text-sm font-semibold text-gray-700">
                Driver Roster — {weekdayFor(date)}, {date}
            </div>

            {rosterError && (
                <div className="text-red-600 text-sm px-3 py-2">{rosterError}</div>
            )}

            {rosterLoading ? (
                <div className="text-sm text-gray-400 px-3 py-3">Loading drivers…</div>
            ) : roster.length === 0 ? (
                <div className="text-sm text-gray-400 px-3 py-3">No active drivers for {airportCode}.</div>
            ) : (
                <div className="max-h-80 overflow-y-auto divide-y">
                    {[...roster]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(driver => {
                            const shift = effectiveShift(driver);
                            const saving = savingDriverId === driver._id;
                            return (
                                <div key={driver._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                                    <label className="flex items-center gap-1.5 w-40 shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={shift.available}
                                            disabled={saving}
                                            onChange={(e) => saveOverride(driver._id, { available: e.target.checked })}
                                        />
                                        <span className={shift.available ? "" : "text-gray-400 line-through"}>
                                            {driver.displayName}
                                        </span>
                                    </label>

                                    {shift.available ? (
                                        <>
                                            <input
                                                type="time"
                                                className="border p-1 rounded text-sm bg-white"
                                                value={shift.startTime}
                                                disabled={saving}
                                                onChange={(e) => saveOverride(driver._id, { startTime: e.target.value })}
                                            />
                                            <span className="text-gray-400">to</span>
                                            <input
                                                type="time"
                                                className="border p-1 rounded text-sm bg-white"
                                                value={shift.endTime}
                                                disabled={saving}
                                                onChange={(e) => saveOverride(driver._id, { endTime: e.target.value })}
                                            />
                                        </>
                                    ) : (
                                        <span className="text-xs text-gray-400">
                                            {shift.worksByDefault
                                                ? "Called out for this date"
                                                : "Not scheduled this day — check to add a one-off shift"}
                                        </span>
                                    )}

                                    {saving && (
                                        <span className="text-xs text-gray-400">Saving…</span>
                                    )}

                                    {shift.hasOverride && (
                                        <button
                                            onClick={() => clearOverride(driver._id)}
                                            disabled={saving}
                                            className="text-xs text-gray-500 hover:text-black underline ml-auto disabled:opacity-50"
                                        >
                                            Reset to default
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}
