const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

// In-memory cache, keyed by origin/destination/5-minute departure bucket.
// Traffic predictions don't meaningfully change inside a 5-minute window,
// and this keeps the same driver->next-pickup pair from hitting the API
// twice when multiple candidate trips check against it.
const cache = new Map();
const BUCKET_MS = 5 * 60 * 1000;

function bucketKey(origin, destination, departureTime) {
    const bucket = Math.floor(departureTime.getTime() / BUCKET_MS);
    return `${origin}|${destination}|${bucket}`;
}

/**
 * Driving duration in minutes between origin and destination, using
 * predicted traffic at departureTime. Falls back to "now" traffic if
 * departureTime has already passed (Google won't predict the past).
 */
export async function getDriveDurationMinutes(origin, destination, departureTime) {
    if (!GOOGLE_MAPS_API_KEY) {
        throw new Error("GOOGLE_MAPS_API_KEY is not configured");
    }
    if (!origin || !destination) {
        throw new Error("origin and destination are required");
    }

    const key = bucketKey(origin, destination, departureTime);
    if (cache.has(key)) return cache.get(key);

    const isFuture = departureTime.getTime() > Date.now();

    const params = new URLSearchParams({
        origins: origin,
        destinations: destination,
        mode: "driving",
        traffic_model: "best_guess",
        departure_time: isFuture
            ? String(Math.floor(departureTime.getTime() / 1000))
            : "now",
        key: GOOGLE_MAPS_API_KEY
    });

    const res = await fetch(`${DISTANCE_MATRIX_URL}?${params.toString()}`);
    const data = await res.json();

    const element = data?.rows?.[0]?.elements?.[0];

    if (!element || element.status !== "OK") {
        throw new Error(
            `Distance Matrix failed for "${origin}" -> "${destination}": ${element?.status || data?.status}`
        );
    }

    // duration_in_traffic only appears when departure_time + traffic data
    // are available; fall back to plain duration otherwise.
    const seconds = element.duration_in_traffic?.value ?? element.duration.value;
    const minutes = seconds / 60;

    cache.set(key, minutes);
    return minutes;
}

// Call between dispatch runs if you want fresh traffic data rather than
// whatever's still sitting in the 5-minute buckets from the last run.
export function clearTravelTimeCache() {
    cache.clear();
}