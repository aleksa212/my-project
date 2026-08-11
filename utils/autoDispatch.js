import { Reservation } from "../models/Reservation.js";
import { Driver } from "../models/Driver.js";
import { Vehicle } from "../models/Vehicle.js";
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
    const eligibleDrivers = activeDrivers
        .map(d => ({ driver: d, shift: d.schedule.find(s => s.day === dayOfWeek) }))
        .filter(d => d.shift);
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
                reason: "No driver/vehicle fits schedule, capacity, vehicle-switch timing, or travel-time constraints"
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
            unassigned.push({ trip, reason: `Could not calculate trip duration: ${err.message}` });
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
                reason: "Completing this trip would run past every eligible driver's scheduled shift end"
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

    return { assigned, unassigned };
}