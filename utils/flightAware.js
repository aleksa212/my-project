const FLIGHTAWARE_API_KEY = process.env.FLIGHTAWARE_API_KEY;
const BASE_URL = "https://aeroapi.flightaware.com/aeroapi";

// A flight ident/number typed by a dispatcher ("AS 1234", "as1234",
// "AS-1234") and AeroAPI's own ident fields ("AS1234") need to match
// regardless of spacing/dashes/case.
const normalizeIdent = (value) =>
    (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

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
