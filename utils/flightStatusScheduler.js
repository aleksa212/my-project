import { Reservation } from "../models/Reservation.js";
import { airportTimeZones } from "./airports.js";
import {
    getFlightByIdent,
    getAirportArrivals,
    matchFlight,
    summarizeArrival,
    localTimeToUtc
} from "./flightAware.js";
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

// Below this, a trip switches from its own per-flight lookup (one billed
// query per trip) to riding along on its airport's shared arrivals-board
// poll (one billed query covers every pending trip at that airport at
// once). This is the whole cost lever at real volume -- per-flight
// lookups scale with trip count, board polls scale with airport count.
// 6h is comfortably inside AeroAPI's own window for a flight going
// active/filed with ATC, so switching over this early rarely leaves a
// gap where neither source has data yet.
const NEAR_HORIZON_MINUTES = 6 * 60;

// How often a still-far-out trip gets re-seeded via its own per-flight
// lookup. Coarse on purpose: checking hourly (the old interval) for up to
// 3 days out is exactly what made per-trip lookups too expensive to run
// at hundreds-of-trips/day scale -- see the AeroAPI cost sizing this
// replaced. Every 4h still catches a multi-hour delay well before it's
// "too close" -- the failure mode this exists for is measured in hours,
// not minutes.
const FAR_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// How often a near trip gets a one-off per-flight lookup fallback when
// the board alone can't be trusted -- two distinct cases:
//   - Never checked by anything yet (flightLastCheckedAt is null): a
//     trip created within NEAR_HORIZON_MINUTES of its own pickup skips
//     the far tier entirely and never gets the seed lookup that would
//     otherwise populate at least its scheduled time. Without this,
//     it shows nothing at all until the board happens to pick it up
//     near departure -- worse than the one-time cost of just asking.
//   - Overdue (reference time already passed, still unresolved): the
//     board indexes by each flight's SCHEDULED slot, not its real/
//     estimated one, so a delayed flight's scheduled slot can pass
//     while it's still genuinely en route, making it invisible on the
//     board the whole time (confirmed live: a flight 55 min delayed,
//     91% en route, never once appeared on the board).
// Tighter than FAR_CHECK_INTERVAL_MS since both cases are more urgent
// than routine far-out re-seeding, but still gated so a trip that's
// already been seeded once and is still ahead of schedule doesn't get
// re-checked on every single 5-min tick while waiting on the board.
const OVERDUE_FALLBACK_INTERVAL_MS = 15 * 60 * 1000;

// Once inside NEAR_HORIZON_MINUTES, an airport's shared board is polled
// on this same near/far urgency curve -- tightest right before pickup,
// looser the further out the airport's nearest pending trip still is.
const BOARD_TIERS = [
    { withinMinutes: 30, intervalMs: 5 * 60 * 1000 },
    { withinMinutes: 180, intervalMs: 15 * 60 * 1000 },
    { withinMinutes: NEAR_HORIZON_MINUTES, intervalMs: 30 * 60 * 1000 }
];

function requiredBoardIntervalMs(minutesUntil) {
    const distance = Math.abs(minutesUntil);
    return (
        BOARD_TIERS.find(t => distance <= t.withinMinutes)?.intervalMs ??
        BOARD_TIERS[BOARD_TIERS.length - 1].intervalMs
    );
}

// Best current estimate of the pickup instant, in preference order:
// FLTactual (most current) > FLTscheduled > the trip's raw PUtime. All
// three are "HH:MM" local-to-the-airport strings.
function referenceTime(trip, timeZone) {
    const timeStr = trip.FLTactual || trip.FLTscheduled || trip.PUtime;
    const dateStr = new Date(trip.PUdate).toISOString().slice(0, 10);
    return localTimeToUtc(dateStr, timeStr, timeZone);
}

// Airport-level "last polled" cadence lives in memory rather than the DB
// -- it's shared across every trip at that airport, so there's no single
// Reservation document to hang it off of. Losing it on a server restart
// just means that airport's board gets polled once right away instead of
// waiting out its interval, same as a trip with no flightLastCheckedAt.
const airportLastCheckedAt = new Map();

async function refreshFarTrip(trip, timeZone, now) {
    const expectedDate = new Date(trip.PUdate).toISOString().slice(0, 10);
    const flight = await getFlightByIdent(trip.FlightNumber, expectedDate, timeZone);
    trip.flightLastCheckedAt = now;

    let updated = false;
    if (flight) {
        const { FLTscheduled, FLTactual, FLTstatus } = summarizeArrival(flight, timeZone);
        if (trip.FLTscheduled !== FLTscheduled || trip.FLTactual !== FLTactual || trip.FLTstatus !== FLTstatus) {
            trip.FLTscheduled = FLTscheduled;
            trip.FLTactual = FLTactual;
            trip.FLTstatus = FLTstatus;
            updated = true;
        }
    }
    await trip.save();
    return updated;
}

async function refreshAirportBoard(airportCode, nearTrips, now) {
    let boardUpdated = 0;
    let boardErrors = 0;
    let fallbackChecked = 0;
    let fallbackUpdated = 0;

    let arrivals;
    try {
        arrivals = await getAirportArrivals(airportCode);
    } catch (err) {
        console.error(`Arrivals board check failed for ${airportCode}:`, err.message);
        return {
            boardUpdated,
            boardErrors: nearTrips.length,
            fallbackChecked,
            fallbackUpdated,
            capped: err.message.includes("monthly query cap reached")
        };
    }

    for (const { trip, timeZone, minutesUntil } of nearTrips) {
        try {
            const expectedDate = new Date(trip.PUdate).toISOString().slice(0, 10);
            const flight = matchFlight(arrivals, trip.FlightNumber, { expectedDate, timeZone });

            if (flight) {
                const { FLTscheduled, FLTactual, FLTstatus } = summarizeArrival(flight, timeZone);
                if (trip.FLTscheduled !== FLTscheduled || trip.FLTactual !== FLTactual || trip.FLTstatus !== FLTstatus) {
                    trip.FLTscheduled = FLTscheduled;
                    trip.FLTactual = FLTactual;
                    trip.FLTstatus = FLTstatus;
                    await trip.save();
                    boardUpdated++;
                }
                continue;
            }

            // Not on the board. Falls back to a per-flight lookup only
            // when the board genuinely can't be relied on to catch up on
            // its own -- never-checked (needs at least a seeded
            // scheduled time) or overdue (see OVERDUE_FALLBACK_INTERVAL_MS
            // above). A trip that's already been seeded once and is
            // still ahead of schedule just keeps waiting on the board,
            // same as before.
            const neverChecked = !trip.flightLastCheckedAt;
            const overdue = minutesUntil < 0;
            if (!neverChecked && !overdue) continue;

            const dueAt = trip.flightLastCheckedAt
                ? trip.flightLastCheckedAt.getTime() + OVERDUE_FALLBACK_INTERVAL_MS
                : 0;
            if (now.getTime() < dueAt) continue;

            fallbackChecked++;
            const fallbackFlight = await getFlightByIdent(trip.FlightNumber, expectedDate, timeZone);
            trip.flightLastCheckedAt = now;
            if (fallbackFlight) {
                const { FLTscheduled, FLTactual, FLTstatus } = summarizeArrival(fallbackFlight, timeZone);
                if (trip.FLTscheduled !== FLTscheduled || trip.FLTactual !== FLTactual || trip.FLTstatus !== FLTstatus) {
                    trip.FLTscheduled = FLTscheduled;
                    trip.FLTactual = FLTactual;
                    trip.FLTstatus = FLTstatus;
                    fallbackUpdated++;
                }
            }
            await trip.save();
        } catch (err) {
            boardErrors++;
            console.error(
                `Board match/save failed for trip #${trip.tripNumber ?? trip._id} (${trip.FlightNumber}):`,
                err.message
            );
        }
    }

    return { boardUpdated, boardErrors, fallbackChecked, fallbackUpdated, capped: false };
}

/**
 * Two-track polling, split at NEAR_HORIZON_MINUTES:
 *
 *  - Far out: one per-flight lookup per trip (its own billed query), on a
 *    coarse interval -- the only way to see schedule data for a flight
 *    that isn't active/filed with ATC yet, but expensive per trip, so
 *    it's kept infrequent.
 *  - Near: trips ride along on their airport's shared arrivals-board poll
 *    -- one query updates every pending trip at that airport at once, so
 *    cost scales with airport count, not trip count, right where the
 *    volume actually is at real fleet size.
 *
 * The previous version used only the far-out (per-flight) path all the
 * way from 3 days out, which is fine at a handful of trips/day but scales
 * linearly with trip volume -- at a few hundred trips/day it turns into
 * hundreds of thousands of billed queries/month. This split keeps the
 * expensive path reserved for the one thing it's uniquely needed for
 * (far-out schedule visibility), and moves everything else onto the
 * cheap shared path.
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

    const farDue = [];
    const nearByAirport = new Map();

    for (const trip of candidates) {
        const timeZone = airportTimeZones[trip.PUlocationCode];
        if (!timeZone) continue; // no timezone configured, skip safely

        const ref = referenceTime(trip, timeZone);
        const minutesUntil = (ref.getTime() - now.getTime()) / 60000;

        if (Math.abs(minutesUntil) > NEAR_HORIZON_MINUTES) {
            const dueAt = trip.flightLastCheckedAt
                ? trip.flightLastCheckedAt.getTime() + FAR_CHECK_INTERVAL_MS
                : 0;
            if (now.getTime() >= dueAt) farDue.push({ trip, timeZone });
            continue;
        }

        if (!nearByAirport.has(trip.PUlocationCode)) nearByAirport.set(trip.PUlocationCode, []);
        nearByAirport.get(trip.PUlocationCode).push({ trip, timeZone, minutesUntil });
    }

    let farChecked = 0, farUpdated = 0, farErrors = 0;
    for (const { trip, timeZone } of farDue) {
        farChecked++;
        try {
            if (await refreshFarTrip(trip, timeZone, now)) farUpdated++;
        } catch (err) {
            farErrors++;
            console.error(
                `Far-out flight check failed for trip #${trip.tripNumber ?? trip._id} (${trip.FlightNumber}):`,
                err.message
            );
            // Stop this whole cycle once the cap is hit -- every
            // remaining call would fail the same way.
            if (err.message.includes("monthly query cap reached")) break;
        }
    }

    let boardsPolled = 0, nearUpdated = 0, nearErrors = 0, overdueFallbackChecked = 0, overdueFallbackUpdated = 0;
    for (const [airportCode, group] of nearByAirport) {
        const nearestMinutes = Math.min(...group.map(g => Math.abs(g.minutesUntil)));
        const interval = requiredBoardIntervalMs(nearestMinutes);
        const lastChecked = airportLastCheckedAt.get(airportCode) ?? 0;
        if (now.getTime() < lastChecked + interval) continue; // not due yet this cycle

        boardsPolled++;
        airportLastCheckedAt.set(airportCode, now.getTime());
        const { boardUpdated, boardErrors, fallbackChecked, fallbackUpdated, capped } = await refreshAirportBoard(airportCode, group, now);
        nearUpdated += boardUpdated;
        nearErrors += boardErrors;
        overdueFallbackChecked += fallbackChecked;
        overdueFallbackUpdated += fallbackUpdated;
        if (capped) break;
    }

    const nearTripsSeen = [...nearByAirport.values()].reduce((sum, g) => sum + g.length, 0);

    return {
        farChecked,
        farUpdated,
        farErrors,
        boardsPolled,
        nearTripsSeen,
        nearUpdated,
        nearErrors,
        overdueFallbackChecked,
        overdueFallbackUpdated,
        candidateCount: candidates.length
    };
}

/**
 * Starts the recurring background poll. Runs once immediately (so a
 * fresh server start doesn't wait a full interval before the grid has
 * current data), then every intervalMs after that. intervalMs should be
 * at or below the tightest tier above (5 min) so that tier can actually
 * take effect -- a 10-minute tick can't honor a 5-minute tier.
 */
export function startFlightStatusPolling(intervalMs) {
    // A cycle touching many airports/far-out trips can run long (the rate
    // limiter in flightAware.js throttles outgoing AeroAPI calls) --
    // without this guard, a tick landing mid-run would start a second
    // overlapping refreshPendingFlights(), doubling up on the same
    // rate-limit budget and re-polling things the first run hasn't
    // gotten to yet.
    let running = false;

    const runAndLog = () => {
        if (running) return;
        running = true;
        refreshPendingFlights()
            .then(async (stats) => {
                const {
                    farChecked, farUpdated, farErrors,
                    boardsPolled, nearTripsSeen, nearUpdated, nearErrors,
                    overdueFallbackChecked, overdueFallbackUpdated,
                    candidateCount
                } = stats;

                if (farChecked > 0 || boardsPolled > 0) {
                    const usage = await getFlightAwareUsage().catch(() => null);
                    console.log(
                        `✈️  Flight status poll: ${candidateCount} pending trip(s) — ` +
                        `${farChecked} far-out checked (${farUpdated} updated${farErrors ? `, ${farErrors} failed` : ""}), ` +
                        `${boardsPolled} airport board(s) polled covering ${nearTripsSeen} near trip(s) ` +
                        `(${nearUpdated} updated${nearErrors ? `, ${nearErrors} failed` : ""})` +
                        (overdueFallbackChecked ? `, ${overdueFallbackChecked} overdue fallback lookup(s) (${overdueFallbackUpdated} updated)` : "") +
                        (usage ? ` — AeroAPI usage: ${usage.count}/${usage.limit} this month` : "")
                    );
                }
            })
            .catch(err => console.error("Flight status poll crashed:", err.message))
            .finally(() => { running = false; });
    };

    runAndLog();
    return setInterval(runAndLog, intervalMs);
}
