import { tryConsumeFlightAwareQuery } from "./flightAwareUsage.js";

const FLIGHTAWARE_API_KEY = process.env.FLIGHTAWARE_API_KEY;
const BASE_URL = "https://aeroapi.flightaware.com/aeroapi";

// A flight ident/number typed by a dispatcher ("AS 1234", "as1234",
// "AS-1234") and AeroAPI's own ident fields ("AS1234") need to match
// regardless of spacing/dashes/case.
const normalizeIdent = (value) =>
    (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// AeroAPI's Personal tier caps at 10 result sets/minute -- separate from
// (and much tighter than) the monthly dollar-based cap in
// flightAwareUsage.js. That cap alone doesn't stop a burst of calls
// within the same minute (confirmed live: 38 per-flight lookups fired
// back-to-back by the tiered scheduler drew "User has reached quota
// limit" from AeroAPI on most of them). This is a process-wide sliding
// window shared by every AeroAPI call site so no combination of callers
// can exceed it. 9, not 10, for a one-call safety margin.
const RATE_LIMIT_PER_MINUTE = 9;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
let recentCallTimestamps = [];

async function waitForRateLimitSlot() {
    const now = Date.now();
    recentCallTimestamps = recentCallTimestamps.filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS
    );
    if (recentCallTimestamps.length >= RATE_LIMIT_PER_MINUTE) {
        const oldest = recentCallTimestamps[0];
        const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldest) + 50;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return waitForRateLimitSlot();
    }
    recentCallTimestamps.push(now);
}

/**
 * One call returns every flight arriving at the given airport within
 * AeroAPI's allowed window (recent past through ~2 days ahead — that's
 * a real constraint of published flight schedule data, not something
 * this code can work around). Deliberately bulk, not per-flight: a
 * dispatcher's whole day of arrivals comes from a single query instead
 * of one call per reservation — see the cost discussion this was built
 * around.
 */
export async function getAirportArrivals(airportCode, { maxPages = 3 } = {}) {
    if (!FLIGHTAWARE_API_KEY) {
        throw new Error("FLIGHTAWARE_API_KEY is not configured");
    }

    const arrivals = [];
    let next = `${BASE_URL}/airports/${encodeURIComponent(airportCode)}/flights/arrivals`;

    for (let page = 0; page < maxPages && next; page++) {
        // Checked BEFORE every request, not just once per call -- a hard
        // stop, not a warning, so a busy day can't quietly blow past the
        // free tier one page at a time.
        const usage = await tryConsumeFlightAwareQuery();
        if (!usage.allowed) {
            throw new Error(
                `FlightAware monthly query cap reached (${usage.count}/${usage.limit}) — ` +
                `staying in the free tier, no further AeroAPI calls this month`
            );
        }

        await waitForRateLimitSlot();
        const res = await fetch(next, { headers: { "x-apikey": FLIGHTAWARE_API_KEY } });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(
                `AeroAPI arrivals lookup failed for "${airportCode}": ${body.detail || res.status}`
            );
        }
        const data = await res.json();
        arrivals.push(...(data.arrivals || []));
        next = data.links?.next ? `${BASE_URL}${data.links.next}` : null;
    }

    return arrivals;
}

// Gives the "YYYY-MM-DD" calendar date an ISO instant falls on in a
// given IANA time zone — used to make sure a match is the right day's
// occurrence of a flight number, not just the right ident.
function localDateStr(isoString, timeZone) {
    const d = new Date(isoString);
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(d);
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
}

// The reverse of localDateStr/toLocalHHMM below: converts a local
// wall-clock date+time in a given IANA time zone into the real UTC
// instant it represents. No timezone library in this project, so this
// uses the standard guess-then-correct trick (also used in
// ColumnDefs.jsx's zonedTimeToUtc) — assume the wall-clock values ARE
// UTC, see what that instant reads as when formatted back in the target
// zone, then shift by the difference (which transparently handles DST).
export function localTimeToUtc(dateStr, timeStr, timeZone) {
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hour, minute] = timeStr.split(":").map(Number);
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute);

    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    });
    const parts = Object.fromEntries(dtf.formatToParts(new Date(utcGuess)).map(p => [p.type, p.value]));

    const asIfUtc = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
    );

    return new Date(utcGuess + (utcGuess - asIfUtc));
}

/**
 * Looks up ONE specific flight number for ONE specific local calendar
 * day. Unlike getAirportArrivals (the airport-wide arrivals board, which
 * only shows flights already active/filed with ATC), this pulls from
 * AeroAPI's schedule data directly — it has the scheduled time even for
 * a flight that's still hours from departing, which is what lets a
 * trip's Flt Scheduled populate immediately instead of waiting for the
 * flight to go active. Costs one query per call (vs. one per airport for
 * the bulk board), which is why this is used sparingly — see the tiered
 * polling in flightStatusScheduler.js.
 */
export async function getFlightByIdent(flightNumber, expectedDate, timeZone) {
    if (!FLIGHTAWARE_API_KEY) {
        throw new Error("FLIGHTAWARE_API_KEY is not configured");
    }

    const ident = normalizeIdent(flightNumber);
    if (!ident) return null;

    const usage = await tryConsumeFlightAwareQuery();
    if (!usage.allowed) {
        throw new Error(
            `FlightAware monthly query cap reached (${usage.count}/${usage.limit}) — ` +
            `staying in the free tier, no further AeroAPI calls this month`
        );
    }

    const start = localTimeToUtc(expectedDate, "00:00", timeZone);
    const end = new Date(start.getTime() + 24 * 60 * 60000);

    const url = `${BASE_URL}/flights/${encodeURIComponent(ident)}` +
        `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;

    await waitForRateLimitSlot();
    const res = await fetch(url, { headers: { "x-apikey": FLIGHTAWARE_API_KEY } });

    if (!res.ok) {
        if (res.status === 404) return null; // no such flight in that window -- not an error
        const body = await res.json().catch(() => ({}));
        throw new Error(`AeroAPI flight lookup failed for "${flightNumber}": ${body.detail || res.status}`);
    }

    const data = await res.json();
    const flights = data.flights || [];

    // Prefer the occurrence actually scheduled for the expected local
    // date, in case the window's edges pulled in an adjacent day's flight.
    return (
        flights.find(f => f.scheduled_in && localDateStr(f.scheduled_in, timeZone) === expectedDate) ||
        flights[0] ||
        null
    );
}

/**
 * Finds the arrival whose ident best matches a dispatcher-entered flight
 * number. Checks the IATA ident first (what most people actually know a
 * flight by, e.g. "AS1234"), then falls back to the ICAO ident/callsign.
 *
 * Flight numbers repeat daily ("DL1203" flies every day, as a different
 * physical flight each time), so an ident match alone isn't enough —
 * when expectedDate/timeZone are given, only arrivals actually scheduled
 * for that calendar day are considered. Without them, this would happily
 * attach today's DL1203 data to a reservation booked for DL1203 next
 * week, which is a different flight entirely.
 */
export function matchFlight(arrivals, flightNumber, { expectedDate, timeZone } = {}) {
    const target = normalizeIdent(flightNumber);
    if (!target) return null;

    const pool = (expectedDate && timeZone)
        ? arrivals.filter(f => f.scheduled_in && localDateStr(f.scheduled_in, timeZone) === expectedDate)
        : arrivals;

    return (
        pool.find(f => normalizeIdent(f.ident_iata) === target) ||
        pool.find(f => normalizeIdent(f.ident) === target) ||
        pool.find(f => normalizeIdent(f.ident_icao) === target) ||
        null
    );
}

/**
 * Converts one of AeroAPI's UTC ISO timestamps to the "HH:MM" 24h local
 * time the rest of this app already uses for PUtime/FLTscheduled/
 * FLTactual (see TripDetailsFields.jsx's <input type="time">).
 */
export function toLocalHHMM(isoString, timeZone) {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone
    });
}

// Below this, a shift is routine gate/taxi noise, not a real delay/early
// arrival worth flagging. 5 min (tighter than the FAA/DOT's own 15-min
// "delayed" definition) so a dispatcher notices meaningful schedule
// shifts sooner, without the "Delayed"/"Early" label firing on every
// minor wobble.
const DELAY_THRESHOLD_SECONDS = 5 * 60;

/**
 * Collapses AeroAPI's raw status into the handful of states a dispatcher
 * actually needs to react to. Uses AeroAPI's own arrival_delay (seconds,
 * positive = late, negative = early) rather than diffing scheduled_in/
 * estimated_in here — that field already accounts for AeroAPI's own
 * rounding/edge cases. Early gets flagged the same as Delayed: both mean
 * "the driver needs to adjust when they show up," just in opposite
 * directions — only a genuinely on-schedule flight is "On Time".
 */
function deriveStatus(flight) {
    if (flight.cancelled) return "Cancelled";
    if (flight.diverted) return "Diverted";
    if (flight.actual_in) return "Landed";

    const delay = flight.arrival_delay ?? 0;
    if (delay > DELAY_THRESHOLD_SECONDS) return "Delayed";
    if (delay < -DELAY_THRESHOLD_SECONDS) return "Early";
    return "On Time";
}

/**
 * The single best "what's actually happening" summary for one matched
 * flight: the ORIGINAL scheduled gate arrival (this doesn't move once a
 * flight is filed for the day, unlike estimated/actual), the current
 * best estimate (switches to the real actual time once landed), and a
 * simplified status: On Time / Delayed / Landed / Diverted / Cancelled.
 */
export function summarizeArrival(flight, timeZone) {
    return {
        FLTscheduled: toLocalHHMM(flight.scheduled_in, timeZone),
        FLTactual: toLocalHHMM(flight.actual_in || flight.estimated_in, timeZone),
        FLTstatus: deriveStatus(flight)
    };
}
