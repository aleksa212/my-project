import { Reservation } from "../models/Reservation.js";
import { airportTimeZones } from "./airports.js";
import { getAirportArrivals, matchFlight, summarizeArrival } from "./flightAware.js";
import { getFlightAwareUsage } from "./flightAwareUsage.js";

const TERMINAL_STATUSES = ["Landed", "Cancelled"];

// Bounds how far back/forward the candidate query looks, purely so this
// job's query doesn't keep growing forever as reservations pile up over
// months of real use -- a trip whose flight never matched (bad flight
// number, etc.) shouldn't get re-checked indefinitely. AeroAPI itself
// only has data from ~11 days back to ~2 days ahead, so a few days of
// slack on each side is plenty without being unbounded.
const LOOKBACK_DAYS = 2;
const LOOKAHEAD_DAYS = 3;

/**
 * Polls FlightAware for every airport that currently has at least one
 * pending (not yet Landed/Cancelled) airport-pickup reservation, and
 * updates FLTscheduled/FLTactual/FLTstatus for whatever matches. One
 * AeroAPI call per airport, not per trip -- an airport with nothing
 * pending right now costs nothing this cycle, and a trip stops being
 * polled the moment its flight lands or gets cancelled.
 */
export async function refreshPendingFlights() {
    const now = new Date();
    const windowStart = new Date(now.getTime() - LOOKBACK_DAYS * 86400000);
    const windowEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * 86400000);

    const candidates = await Reservation.find({
        PUlocationCode: { $nin: ["", null] },
        FLTstatus: { $nin: TERMINAL_STATUSES },
        PUdate: { $gte: windowStart, $lte: windowEnd }
    });

    const byAirport = new Map();
    for (const trip of candidates) {
        const code = trip.PUlocationCode;
        if (!airportTimeZones[code]) continue; // no timezone configured, skip safely
        if (!byAirport.has(code)) byAirport.set(code, []);
        byAirport.get(code).push(trip);
    }

    let tripsUpdated = 0;
    let airportErrors = 0;

    for (const [airportCode, trips] of byAirport) {
        try {
            const arrivals = await getAirportArrivals(airportCode);
            const timeZone = airportTimeZones[airportCode];

            for (const trip of trips) {
                const expectedDate = new Date(trip.PUdate).toISOString().slice(0, 10);
                const flight = matchFlight(arrivals, trip.FlightNumber, { expectedDate, timeZone });
                if (!flight) continue;

                const { FLTscheduled, FLTactual, FLTstatus } = summarizeArrival(flight, timeZone);
                if (
                    trip.FLTscheduled === FLTscheduled &&
                    trip.FLTactual === FLTactual &&
                    trip.FLTstatus === FLTstatus
                ) {
                    continue; // nothing actually changed, skip the write
                }

                trip.FLTscheduled = FLTscheduled;
                trip.FLTactual = FLTactual;
                trip.FLTstatus = FLTstatus;
                await trip.save();
                tripsUpdated++;
            }
        } catch (err) {
            airportErrors++;
            console.error(`Flight status poll failed for "${airportCode}":`, err.message);
        }
    }

    return { airportsPolled: byAirport.size, tripsUpdated, airportErrors };
}

/**
 * Starts the recurring background poll. Runs once immediately (so a
 * fresh server start doesn't wait a full interval before the grid has
 * current data), then every intervalMs after that.
 */
export function startFlightStatusPolling(intervalMs) {
    const runAndLog = () => {
        refreshPendingFlights()
            .then(async ({ airportsPolled, tripsUpdated, airportErrors }) => {
                if (airportsPolled > 0 || tripsUpdated > 0) {
                    const usage = await getFlightAwareUsage().catch(() => null);
                    console.log(
                        `✈️  Flight status poll: ${airportsPolled} airport(s) checked, ${tripsUpdated} trip(s) updated` +
                        (airportErrors ? `, ${airportErrors} airport(s) failed` : "") +
                        (usage ? ` — AeroAPI usage: ${usage.count}/${usage.limit} this month` : "")
                    );
                }
            })
            .catch(err => console.error("Flight status poll crashed:", err.message));
    };

    runAndLog();
    return setInterval(runAndLog, intervalMs);
}
