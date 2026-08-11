import { Reservation } from "../models/Reservation.js";
import { Driver } from "../models/Driver.js";
import { Vehicle } from "../models/Vehicle.js";
import { DriverDayOverride } from "../models/DriverDayOverride.js";
import { getDriveDurationMinutes } from "../utils/travelTime.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BUFFER_MINUTES = 10;
const AIRPORT_PICKUP_BUFFER_MINUTES = 20;
const SWITCH_GAP_MINUTES = 150;

const toMinutes = (timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
};

const resolveAddress = (code, name, raw) => (code && name ? name : raw);

// PUdate is stored as UTC midnight of the intended calendar day (a bare
// "YYYY-MM-DD" string parses that way — see reservations.js), so its
// day/month/year must be read back with the UTC getters. Reading them
// with local getters/setters (the previous bug) shifts the calendar day
// backward by one in any timezone behind UTC, which silently pushed every
// "today" trip's computed pickup instant into the past — breaking
// Google's traffic prediction (it only predicts for future departures).
const combineDateTime = (dateObj, timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    const source = new Date(dateObj);
    return new Date(
        source.getUTCFullYear(),
        source.getUTCMonth(),
        source.getUTCDate(),
        h, m, 0, 0
    );
};

const sameDate = (dateObj, dateStr) =>
    new Date(dateObj).toISOString().slice(0, 10) === dateStr;

// PUlocationCode is only populated when the pickup resolves to an airport
// code (see reservations.js), so its presence is the airport-pickup flag.
const isAirportPickup = (trip) => Boolean(trip.PUlocationCode);

// Flight-landing time (PUtime) isn't when the ride actually starts —
// passengers need time to deplane and get curbside. Everything downstream
// (arrival deadline, traffic-time basis, freeAt) should key off this.
const actualDepartureTime = (trip, puDateTime) =>
    isAirportPickup(trip)
        ? new Date(puDateTime.getTime() + AIRPORT_PICKUP_BUFFER_MINUTES * 60000)
        : puDateTime;

/**
 * Replays already-assigned trips to reconstruct today's real schedule.
 * Takes driversForLookup/vehiclesByNumber as full (active + inactive)
 * lists — a trip dispatched to someone who's since quit, or a vehicle
 * that's since been taken out of service, still needs to resolve
 * correctly so today's already-committed schedule doesn't silently drop.
 */
async function buildStateFromFixedTrips(fixedTrips, driversForLookup, vehiclesByNumber) {
    const driverState = new Map();
    const vehicleHolder = new Map();

    const byDriverName = new Map();
    for (const t of fixedTrips) {
        if (!t.Driver) continue;
        if (!byDriverName.has(t.Driver)) byDriverName.set(t.Driver, []);
        byDriverName.get(t.Driver).push(t);
    }

    for (const [driverName, driverTrips] of byDriverName) {
        const driver = driversForLookup.find(d => d.displayName === driverName);
        if (!driver) continue;

        driverTrips.sort((a, b) => toMinutes(a.PUtime) - toMinutes(b.PUtime));

        let vehicle = null;
        let lastDropoffAddress = null;
        let freeAt = null;
        let tripCount = 0;

        for (const t of driverTrips) {
            const puAddress = resolveAddress(t.PUlocationCode, t.PUlocationName, t.PUlocation);
            const doAddress = resolveAddress(t.DOlocationCode, t.DOlocationName, t.DOlocation);
            const puDateTime = combineDateTime(t.PUdate, t.PUtime);
            const departureTime = actualDepartureTime(t, puDateTime);

            let tripFreeAt;

            if (t.tripDurationMinutes != null && t.estimatedDropoff) {
                tripFreeAt = new Date(t.estimatedDropoff);
            } else {
                let durationMinutes = 0;
                try {
                    durationMinutes = await getDriveDurationMinutes(puAddress, doAddress, departureTime);
                } catch {
                    // best-effort reconstruction
                }
                tripFreeAt = new Date(departureTime.getTime() + durationMinutes * 60000);

                Reservation.updateOne(
                    { _id: t._id },
                    { $set: { tripDurationMinutes: durationMinutes, estimatedDropoff: tripFreeAt } }
                ).catch(() => {});
            }

            const tripVehicle = vehiclesByNumber.get(t.VEHnumber) || vehicle;

            if (tripVehicle && vehicle && tripVehicle.id !== vehicle.id) {
                vehicleHolder.set(vehicle.id, null);
            }
            if (tripVehicle) vehicleHolder.set(tripVehicle.id, driver.id);

            vehicle = tripVehicle || vehicle;
            lastDropoffAddress = doAddress;
            freeAt = tripFreeAt;
            tripCount += 1;
        }

        driverState.set(driver.id, { vehicle, lastDropoffAddress, freeAt, tripCount });
    }

    return { driverState, vehicleHolder };
}

export async function runAutoDispatch(airportCode, dateStr, options = {}) {
    const { tripIds = null } = options;
    // Same UTC-vs-local reasoning as combineDateTime above.
    const dayOfWeek = DAY_NAMES[new Date(dateStr).getUTCDay()];

    const [allTripsToday, activeDrivers, allDriversAtAirport, activeVehicles, allVehiclesAtAirport] = await Promise.all([
        Reservation.find({ Area: airportCode }),
        Driver.find({ airportCode, active: true }),
        Driver.find({ airportCode }),
        Vehicle.find({ airportCode, active: true }),
        Vehicle.find({ airportCode })
    ]);

    // Per-date exceptions to the default weekly schedule (call-outs and
    // one-off hour changes), keyed by driver id for quick lookup below.
    const dayOverrides = await DriverDayOverride.find({
        driver: { $in: activeDrivers.map(d => d.id) },
        date: dateStr
    });
    const overrideByDriverId = new Map(dayOverrides.map(o => [String(o.driver), o]));

    const tripsForDate = allTripsToday.filter(t => sameDate(t.PUdate, dateStr));
    const fixedTrips = tripsForDate.filter(t => t.Status !== "Unassigned" && t.Driver);

    let trips = tripsForDate.filter(t => t.Status === "Unassigned");
    if (tripIds) {
        const idSet = new Set(tripIds.map(String));
        trips = trips.filter(t => idSet.has(String(t._id)));
    }
    trips.sort((a, b) => toMinutes(a.PUtime) - toMinutes(b.PUtime));

    // Full (active + inactive) lookup, used ONLY to resolve history.
    const vehiclesByNumberAll = new Map(allVehiclesAtAirport.map(v => [v.vehicleNumber, v]));

    // Active-only — the sole source of candidates for NEW assignments.
    // A day override can either drop a driver entirely (called out) or
    // swap in one-off hours for just this date; with no override, it's
    // whatever their default weekly schedule says for this weekday.
    const eligibleDrivers = activeDrivers
        .map(d => {
            const override = overrideByDriverId.get(String(d.id));
            if (override && override.available === false) return null;

            const shift = override?.startTime && override?.endTime
                ? { day: dayOfWeek, startTime: override.startTime, endTime: override.endTime }
                : d.schedule.find(s => s.day === dayOfWeek);

            return shift ? { driver: d, shift } : null;
        })
        .filter(Boolean);
    const shiftByDriverId = new Map(eligibleDrivers.map(d => [d.driver.id, d.shift]));

    const vehiclesByCapacity = [...activeVehicles].sort((a, b) => a.capacity - b.capacity);

    const { driverState: fixedDriverState, vehicleHolder: fixedVehicleHolder } =
        await buildStateFromFixedTrips(fixedTrips, allDriversAtAirport, vehiclesByNumberAll);

    const vehicleHolder = new Map(activeVehicles.map(v => [v.id, null]));
    for (const [vId, driverId] of fixedVehicleHolder) vehicleHolder.set(vId, driverId);

    const driverState = new Map(
        eligibleDrivers.map(d => [
            d.driver.id,
            fixedDriverState.get(d.driver.id) || { vehicle: null, lastDropoffAddress: null, freeAt: null, tripCount: 0 }
        ])
    );

    const assigned = [];
    const unassigned = [];

    for (const trip of trips) {
        const puAddress = resolveAddress(trip.PUlocationCode, trip.PUlocationName, trip.PUlocation);
        const doAddress = resolveAddress(trip.DOlocationCode, trip.DOlocationName, trip.DOlocation);
        const pax = Number(trip.PAX) || 1;
        const puDateTime = combineDateTime(trip.PUdate, trip.PUtime);
        const departureTime = actualDepartureTime(trip, puDateTime);
        const puMinutes = toMinutes(trip.PUtime);

        const candidates = [];

        for (const { driver, shift } of eligibleDrivers) {
            const shiftStart = toMinutes(shift.startTime);
            const shiftEnd = toMinutes(shift.endTime);
            if (puMinutes < shiftStart || puMinutes > shiftEnd) continue;

            const state = driverState.get(driver.id);

            if (!state.vehicle) {
                const vehicle = vehiclesByCapacity.find(
                    v => v.capacity >= pax && vehicleHolder.get(v.id) == null
                );
                if (!vehicle) continue;
                candidates.push({ driver, vehicle, deadheadMinutes: 0, switched: false });
                continue;
            }

            let deadheadMinutes;
            try {
                deadheadMinutes = await getDriveDurationMinutes(
                    state.lastDropoffAddress,
                    puAddress,
                    state.freeAt
                );
            } catch {
                continue;
            }

            const arrivalAtPickup = new Date(
                state.freeAt.getTime() + (deadheadMinutes + BUFFER_MINUTES) * 60000
            );
            if (arrivalAtPickup > departureTime) continue;

            const gapMinutes = (departureTime.getTime() - state.freeAt.getTime()) / 60000;
            const canSwitchVehicle = gapMinutes >= SWITCH_GAP_MINUTES;

            if (state.vehicle.capacity >= pax) {
                candidates.push({ driver, vehicle: state.vehicle, deadheadMinutes, switched: false });
            }

            if (canSwitchVehicle) {
                const altVehicle = vehiclesByCapacity.find(
                    v => v.id !== state.vehicle.id &&
                         v.capacity >= pax &&
                         vehicleHolder.get(v.id) == null
                );
                if (altVehicle) {
                    candidates.push({ driver, vehicle: altVehicle, deadheadMinutes, switched: true });
                }
            }
        }

        if (candidates.length === 0) {
            unassigned.push({
                trip,
                reason: "No driver/vehicle fits schedule, capacity, vehicle-switch timing, or travel-time constraints",
                reasonCode: "NO_CANDIDATE"
            });
            continue;
        }

        candidates.sort((a, b) => {
            const countA = driverState.get(a.driver.id).tripCount;
            const countB = driverState.get(b.driver.id).tripCount;
            if (countA !== countB) return countA - countB;
            if (a.switched !== b.switched) return a.switched ? 1 : -1;
            return a.deadheadMinutes - b.deadheadMinutes;
        });

        let tripDurationMinutes;
        try {
            tripDurationMinutes = await getDriveDurationMinutes(puAddress, doAddress, departureTime);
        } catch (err) {
            unassigned.push({
                trip,
                reason: `Could not calculate trip duration: ${err.message}`,
                reasonCode: "DURATION_ERROR"
            });
            continue;
        }

        const freeAt = new Date(departureTime.getTime() + tripDurationMinutes * 60000);
        const crossesMidnight = freeAt.toDateString() !== puDateTime.toDateString();
        const freeAtMinutes = freeAt.getHours() * 60 + freeAt.getMinutes();

        let chosen = null;
        for (const c of candidates) {
            const shiftEnd = toMinutes(shiftByDriverId.get(c.driver.id).endTime);
            if (!crossesMidnight && freeAtMinutes > shiftEnd) continue;
            chosen = c;
            break;
        }

        if (!chosen) {
            unassigned.push({
                trip,
                reason: "Completing this trip would run past every eligible driver's scheduled shift end",
                reasonCode: "SHIFT_OVERRUN"
            });
            continue;
        }

        const state = driverState.get(chosen.driver.id);

        if (chosen.switched && state.vehicle) {
            vehicleHolder.set(state.vehicle.id, null);
        }
        vehicleHolder.set(chosen.vehicle.id, chosen.driver.id);

        driverState.set(chosen.driver.id, {
            vehicle: chosen.vehicle,
            lastDropoffAddress: doAddress,
            freeAt,
            tripCount: state.tripCount + 1
        });

        assigned.push({
            tripId: trip._id,
            PUtime: trip.PUtime,
            PUlocation: puAddress,
            DOlocation: doAddress,
            PAX: trip.PAX,
            driverId: chosen.driver.id,
            driverName: chosen.driver.displayName,
            vehicleId: chosen.vehicle.id,
            vehicleNumber: chosen.vehicle.vehicleNumber,
            vehicleSwitched: chosen.switched,
            estimatedDropoff: freeAt,
            tripDurationMinutes
        });
    }

    // ---- Double pickup (last resort) ----
    // A trip that couldn't get its own driver/vehicle above may still be
    // served by piggybacking onto a driver already committed to the exact
    // same PU->DO leg at nearly the same time (e.g. two guests from the
    // same block leaving the same hotel for the same venue a few minutes
    // apart). This only runs AFTER every trip has had a fair shot at its
    // own driver — two drivers is always preferred over one when both are
    // actually available, so this never competes with a normal
    // assignment, it only catches trips that would otherwise go
    // unassigned. Airport pickups are excluded entirely: landing/
    // deplaning timing is too unpredictable to safely stack a second
    // party on top of it. Deliberately pairs only (not triples) — a
    // trip used as the "primary" here can't also be piggybacked onto by
    // yet another trip in the same pass.
    const DOUBLE_PICKUP_WINDOW_MINUTES = 5;
    const usedAsPrimary = new Set();

    const placedTrips = [
        ...assigned.map(a => ({
            tripId: String(a.tripId),
            PUlocation: a.PUlocation,
            DOlocation: a.DOlocation,
            PUtime: a.PUtime,
            PAX: Number(a.PAX) || 1,
            driverId: a.driverId,
            driverName: a.driverName,
            vehicleId: a.vehicleId,
            vehicleNumber: a.vehicleNumber,
            vehicleCapacity: vehiclesByNumberAll.get(a.vehicleNumber)?.capacity ?? 0,
            estimatedDropoff: a.estimatedDropoff,
            tripDurationMinutes: a.tripDurationMinutes,
            assignedRef: a
        })),
        ...fixedTrips.map(t => ({
            tripId: String(t._id),
            PUlocation: t.PUlocation,
            DOlocation: t.DOlocation,
            PUtime: t.PUtime,
            PAX: Number(t.PAX) || 1,
            driverId: null,
            driverName: t.Driver,
            vehicleId: null,
            vehicleNumber: t.VEHnumber,
            vehicleCapacity: vehiclesByNumberAll.get(t.VEHnumber)?.capacity ?? 0,
            estimatedDropoff: t.estimatedDropoff,
            tripDurationMinutes: t.tripDurationMinutes,
            assignedRef: null
        }))
    ];

    const stillUnassigned = [];
    for (const entry of unassigned) {
        const { trip, reasonCode } = entry;

        if (reasonCode !== "NO_CANDIDATE" || isAirportPickup(trip)) {
            stillUnassigned.push(entry);
            continue;
        }

        const puAddress = resolveAddress(trip.PUlocationCode, trip.PUlocationName, trip.PUlocation);
        const doAddress = resolveAddress(trip.DOlocationCode, trip.DOlocationName, trip.DOlocation);
        const pax = Number(trip.PAX) || 1;
        const puMinutes = toMinutes(trip.PUtime);
        const tripId = String(trip._id);

        const partner = placedTrips.find(p =>
            !usedAsPrimary.has(p.tripId) &&
            p.tripId !== tripId &&
            p.PUlocation === puAddress &&
            p.DOlocation === doAddress &&
            Math.abs(toMinutes(p.PUtime) - puMinutes) <= DOUBLE_PICKUP_WINDOW_MINUTES &&
            p.PAX + pax <= p.vehicleCapacity
        );

        if (!partner) {
            stillUnassigned.push(entry);
            continue;
        }

        usedAsPrimary.add(partner.tripId);
        if (partner.assignedRef) partner.assignedRef.doublePickupPartnerId = trip._id;

        assigned.push({
            tripId: trip._id,
            PUtime: trip.PUtime,
            PUlocation: puAddress,
            DOlocation: doAddress,
            PAX: trip.PAX,
            driverId: partner.driverId,
            driverName: partner.driverName,
            vehicleId: partner.vehicleId,
            vehicleNumber: partner.vehicleNumber,
            vehicleSwitched: false,
            estimatedDropoff: partner.estimatedDropoff,
            tripDurationMinutes: partner.tripDurationMinutes,
            doublePickupPartnerId: partner.tripId
        });
    }
    unassigned.length = 0;
    unassigned.push(...stillUnassigned);

    return { assigned, unassigned };
}

const fmtTime = (date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

/**
 * Re-checks every already-dispatched trip for an airport/date against the
 * exact same rules runAutoDispatch enforces when making a fresh
 * assignment — shift coverage, vehicle capacity, and travel-time
 * feasibility from the driver's previous drop-off. Nothing here creates
 * or reassigns anything; it only reports what no longer holds, which
 * matters because a manual edit after the fact (syncing a pickup time to
 * a flight's actual arrival, swapping a vehicle, etc.) can silently break
 * a schedule that was valid at commit time.
 *
 * Consecutive same-driver trips sharing an identical PU/DO within the
 * double-pickup window are treated as one physical drive (one combined
 * capacity check, one advance of the driver's freeAt) rather than two
 * sequential ones — otherwise a legitimate double pickup would look like
 * "drive from this address back to this same address," a false conflict.
 */
export async function findScheduleConflicts(airportCode, dateStr) {
    const dayOfWeek = DAY_NAMES[new Date(dateStr).getUTCDay()];
    const DOUBLE_PICKUP_WINDOW_MINUTES = 5;

    const [allTripsToday, allDrivers, allVehicles] = await Promise.all([
        Reservation.find({ Area: airportCode }),
        Driver.find({ airportCode }),
        Vehicle.find({ airportCode })
    ]);

    const dayOverrides = await DriverDayOverride.find({
        driver: { $in: allDrivers.map(d => d.id) },
        date: dateStr
    });
    const overrideByDriverId = new Map(dayOverrides.map(o => [String(o.driver), o]));

    const tripsForDate = allTripsToday.filter(t => sameDate(t.PUdate, dateStr));
    const fixedTrips = tripsForDate.filter(t => t.Status !== "Unassigned" && t.Driver);

    const vehiclesByNumber = new Map(allVehicles.map(v => [v.vehicleNumber, v]));

    const byDriverName = new Map();
    for (const t of fixedTrips) {
        if (!byDriverName.has(t.Driver)) byDriverName.set(t.Driver, []);
        byDriverName.get(t.Driver).push(t);
    }

    const conflicts = [];

    for (const [driverName, driverTrips] of byDriverName) {
        const driver = allDrivers.find(d => d.displayName === driverName);
        driverTrips.sort((a, b) => toMinutes(a.PUtime) - toMinutes(b.PUtime));

        const override = driver ? overrideByDriverId.get(String(driver.id)) : null;
        const calledOut = Boolean(override && override.available === false);
        const shift = driver && !calledOut
            ? (override?.startTime && override?.endTime
                ? { startTime: override.startTime, endTime: override.endTime }
                : driver.schedule.find(s => s.day === dayOfWeek))
            : null;

        const clusters = [];
        for (const t of driverTrips) {
            const puAddress = resolveAddress(t.PUlocationCode, t.PUlocationName, t.PUlocation);
            const doAddress = resolveAddress(t.DOlocationCode, t.DOlocationName, t.DOlocation);
            const last = clusters[clusters.length - 1];

            if (
                last &&
                last.puAddress === puAddress &&
                last.doAddress === doAddress &&
                Math.abs(toMinutes(t.PUtime) - toMinutes(last.trips[0].PUtime)) <= DOUBLE_PICKUP_WINDOW_MINUTES
            ) {
                last.trips.push(t);
            } else {
                clusters.push({ puAddress, doAddress, trips: [t] });
            }
        }

        let lastDropoffAddress = null;
        let freeAt = null;

        for (const cluster of clusters) {
            const first = cluster.trips[0];
            const puDateTime = combineDateTime(first.PUdate, first.PUtime);
            const departureTime = actualDepartureTime(first, puDateTime);
            const totalPax = cluster.trips.reduce((sum, t) => sum + (Number(t.PAX) || 1), 0);

            const reasonsByTrip = new Map(cluster.trips.map(t => [t, []]));
            const addReason = (t, msg) => reasonsByTrip.get(t).push(msg);
            const addReasonAll = (msg) => cluster.trips.forEach(t => addReason(t, msg));

            if (!driver) {
                addReasonAll(`Assigned driver "${driverName}" no longer exists`);
            } else if (calledOut) {
                addReasonAll(`Driver is called out for ${dateStr}`);
            } else if (!shift) {
                addReasonAll(`Driver is not scheduled to work on ${dayOfWeek}`);
            } else {
                const shiftStart = toMinutes(shift.startTime);
                const shiftEnd = toMinutes(shift.endTime);
                const puMinutes = toMinutes(first.PUtime);
                if (puMinutes < shiftStart || puMinutes > shiftEnd) {
                    addReasonAll(`Pickup ${first.PUtime} is outside ${driverName}'s shift (${shift.startTime}-${shift.endTime})`);
                }
            }

            // Every trip in a cluster should share one VEHnumber (that's
            // what makes it a double pickup) -- checked per-trip anyway
            // in case an edit desynced them.
            for (const t of cluster.trips) {
                const veh = vehiclesByNumber.get(t.VEHnumber);
                if (!veh) {
                    addReason(t, `Vehicle "${t.VEHnumber}" not found`);
                } else if (totalPax > veh.capacity) {
                    addReason(t, `Combined PAX (${totalPax}) exceeds vehicle ${t.VEHnumber}'s capacity (${veh.capacity})`);
                }
            }

            if (freeAt && lastDropoffAddress) {
                try {
                    const deadheadMinutes = await getDriveDurationMinutes(lastDropoffAddress, cluster.puAddress, freeAt);
                    const arrivalAtPickup = new Date(freeAt.getTime() + (deadheadMinutes + BUFFER_MINUTES) * 60000);
                    if (arrivalAtPickup > departureTime) {
                        addReasonAll(
                            `Driver can't reach this pickup from the previous drop-off in time ` +
                            `(would arrive ~${fmtTime(arrivalAtPickup)}, needed by ${fmtTime(departureTime)})`
                        );
                    }
                } catch (err) {
                    addReasonAll(`Could not verify travel time from the previous trip: ${err.message}`);
                }
            }

            let tripDurationMinutes = first.tripDurationMinutes;
            let tripFreeAt = first.estimatedDropoff ? new Date(first.estimatedDropoff) : null;
            if (tripDurationMinutes == null || !tripFreeAt) {
                try {
                    tripDurationMinutes = await getDriveDurationMinutes(cluster.puAddress, cluster.doAddress, departureTime);
                    tripFreeAt = new Date(departureTime.getTime() + tripDurationMinutes * 60000);
                    Reservation.updateOne(
                        { _id: first._id },
                        { $set: { tripDurationMinutes, estimatedDropoff: tripFreeAt } }
                    ).catch(() => {});
                } catch (err) {
                    addReasonAll(`Could not calculate trip duration: ${err.message}`);
                    tripFreeAt = null;
                }
            }

            if (shift && tripFreeAt) {
                const shiftEnd = toMinutes(shift.endTime);
                const crossesMidnight = tripFreeAt.toDateString() !== puDateTime.toDateString();
                const freeAtMinutes = tripFreeAt.getHours() * 60 + tripFreeAt.getMinutes();
                if (!crossesMidnight && freeAtMinutes > shiftEnd) {
                    addReasonAll(`Completing this trip runs past ${driverName}'s shift end (${shift.endTime})`);
                }
            }

            for (const t of cluster.trips) {
                const reasons = reasonsByTrip.get(t);
                if (reasons.length > 0) conflicts.push({ trip: t, reasons });
            }

            lastDropoffAddress = cluster.doAddress;
            freeAt = tripFreeAt || freeAt;
        }
    }

    return conflicts;
}