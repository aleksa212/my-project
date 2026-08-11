import { FlightAwareUsage } from "../models/FlightAwareUsage.js";

// Based on real observed billing (FlightAware's own "API Usage" tab):
// 27 calls to GET /airports/{id}/flights/arrivals cost $0.13, i.e.
// ~$0.0048/query — the Personal tier's ~$5/month free credit covers
// roughly 1,040 queries/month at that rate. Capped well below that
// (not right at it) as margin for other endpoint types being priced
// differently, or FlightAware adjusting rates later.
const MONTHLY_QUERY_LIMIT = 800;

const currentMonth = () => new Date().toISOString().slice(0, 7);

async function getCurrentUsage() {
    const month = currentMonth();
    const doc = await FlightAwareUsage.findById("flightAwareUsage");
    if (!doc || doc.month !== month) {
        // New month (or first-ever call) -- reset the counter.
        return FlightAwareUsage.findByIdAndUpdate(
            "flightAwareUsage",
            { month, count: 0 },
            { upsert: true, returnDocument: "after" }
        );
    }
    return doc;
}

/**
 * Call once per actual AeroAPI HTTP request, BEFORE making it. Returns
 * { allowed: false } once the monthly cap is hit instead of letting the
 * call through -- a hard fail-safe, not just a warning, since the whole
 * point is staying in the free tier during development without having
 * to trust an external notification arriving in time.
 */
export async function tryConsumeFlightAwareQuery() {
    const doc = await getCurrentUsage();

    if (doc.count >= MONTHLY_QUERY_LIMIT) {
        return { allowed: false, count: doc.count, limit: MONTHLY_QUERY_LIMIT };
    }

    const updated = await FlightAwareUsage.findByIdAndUpdate(
        "flightAwareUsage",
        { $inc: { count: 1 } },
        { upsert: true, returnDocument: "after" }
    );

    return { allowed: true, count: updated.count, limit: MONTHLY_QUERY_LIMIT };
}

export async function getFlightAwareUsage() {
    const doc = await getCurrentUsage();
    return { count: doc.count, limit: MONTHLY_QUERY_LIMIT, month: doc.month };
}
