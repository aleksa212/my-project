import { Reservation } from "../models/Reservation.js";
import { TripOffer } from "../models/TripOffer.js";
import { airportTimeZones } from "./airports.js";
import { localTimeToUtc } from "./flightAware.js";
import { runAutoDispatch } from "./autoDispatch.js";

// "1 hour before" from the feature ask this was built from -- once an
// Unassigned trip's pickup is this close, it's worth actively offering
// out to eligible drivers rather than waiting on a dispatcher to notice.
const OFFER_WINDOW_MINUTES = 60;

const NO_CANDIDATE_NOTE = "no drivers available for offer";
const EXPIRED_NOTE = "offer expired unaccepted";

function pickupInstant(trip) {
    const timeZone = airportTimeZones[trip.Area];
    if (!timeZone) return null;
    const dateStr = new Date(trip.PUdate).toISOString().slice(0, 10);
    return localTimeToUtc(dateStr, trip.PUtime, timeZone);
}

// Same idempotent-note pattern as dispatchRoutes.js's check-conflicts --
// flags for dispatcher attention without piling up duplicate notes if
// this runs again before someone acts on it.
async function flagNeedsAttention(trip, note) {
    if ((trip.DISPnotes || "").includes(note)) return;
    trip.Status = "needs attention";
    trip.DISPnotes = [trip.DISPnotes, note].filter(Boolean).join(" | ");
    await trip.save();
}

/**
 * A dispatcher manually assigning a "Bidding" trip (through the normal
 * edit/bulk-edit route or by running Auto Dispatch on it) always wins
 * over the offer system -- the atomic accept guard in routes/
 * tripOffers.js already stops a driver from grabbing a trip that's moved
 * off "Bidding", but without this the TripOffer record itself would just
 * sit at "pending" forever with nothing to show it was actually resolved
 * by a person, not by a driver accepting. Callers (routes/reservations.js,
 * routes/dispatchRoutes.js) call this whenever a trip's Status is about
 * to move off "Bidding" through a manual path.
 */
export async function cancelPendingOfferForTrip(tripId) {
    await TripOffer.updateOne(
        { trip: tripId, status: "pending" },
        { status: "cancelled" }
    );
}

/**
 * Two jobs, each cycle:
 *
 *  1. Unassigned trips that just entered the 1h-out window and don't yet
 *     have an offer get one created -- candidates are computed ONCE per
 *     trip (via Auto Dispatch's own feasibility rules, see
 *     runAutoDispatch's "candidates" mode) and stay fixed for the life of
 *     that offer. This is deliberate, not an oversight: computing
 *     candidates calls out to Google's Distance Matrix API per driver
 *     under consideration, so recomputing on every poll tick for a trip
 *     that's already been offered would multiply that cost for no real
 *     benefit -- a dispatcher can always intervene manually if something
 *     about a driver's availability changes after the fact.
 *  2. Pending offers whose pickup time has now passed without anyone
 *     accepting are expired, and the trip is flagged for a dispatcher to
 *     pick up manually.
 *
 * No driver-facing app exists yet -- this only maintains the
 * TripOffer records; routes/tripOffers.js is what a future app would
 * actually call.
 */
export async function refreshTripOffers() {
    const now = new Date();

    const unassigned = await Reservation.find({
        Status: "Unassigned",
        Area: { $nin: ["", null] }
    });

    const existingOfferTripIds = new Set(
        (await TripOffer.find({ trip: { $in: unassigned.map(t => t._id) } }, { trip: 1 }))
            .map(o => String(o.trip))
    );

    let offersCreated = 0;
    let flaggedNoCandidates = 0;
    let offersExpired = 0;

    for (const trip of unassigned) {
        if (existingOfferTripIds.has(String(trip._id))) continue;

        const pickup = pickupInstant(trip);
        if (!pickup) continue; // no timezone configured for this Area, skip safely

        const minutesUntil = (pickup.getTime() - now.getTime()) / 60000;
        if (minutesUntil > OFFER_WINDOW_MINUTES || minutesUntil < 0) continue;

        let candidatesByTrip;
        try {
            ({ candidatesByTrip } = await runAutoDispatch(trip.Area, new Date(trip.PUdate).toISOString().slice(0, 10), {
                tripIds: [trip._id],
                mode: "candidates"
            }));
        } catch (err) {
            console.error(`Offer candidate lookup failed for trip #${trip.tripNumber ?? trip._id}:`, err.message);
            continue;
        }

        const candidates = candidatesByTrip[0]?.candidates || [];
        if (candidates.length === 0) {
            await flagNeedsAttention(trip, NO_CANDIDATE_NOTE);
            flaggedNoCandidates++;
            continue;
        }

        await TripOffer.findOneAndUpdate(
            { trip: trip._id },
            {
                trip: trip._id,
                offers: candidates.map(c => ({ driver: c.driverId, vehicle: c.vehicleId })),
                status: "pending",
                acceptedByDriver: null,
                acceptedAt: null,
                lastOfferedAt: now
            },
            { upsert: true }
        );
        // Distinct from "Unassigned" so a dispatcher can tell "nobody's
        // looked at this" apart from "actively out for driver
        // acceptance" at a glance (shows purple in the grid). Also
        // doubles as the accept route's atomic guard condition -- see
        // routes/tripOffers.js.
        trip.Status = "Bidding";
        await trip.save();
        offersCreated++;
    }

    // Expire anything still pending whose pickup has now passed.
    const pendingOffers = await TripOffer.find({ status: "pending" }).populate("trip");
    for (const offer of pendingOffers) {
        const trip = offer.trip;
        // Status moving off "Bidding" means it got resolved some other
        // way (a dispatcher manually assigned it, or a driver already
        // accepted) -- nothing left for this pass to do.
        if (!trip || trip.Status !== "Bidding") continue;

        const pickup = pickupInstant(trip);
        if (!pickup || pickup.getTime() >= now.getTime()) continue;

        offer.status = "expired";
        await offer.save();
        await flagNeedsAttention(trip, EXPIRED_NOTE);
        offersExpired++;
    }

    return { candidateCount: unassigned.length, offersCreated, flaggedNoCandidates, offersExpired };
}

export function startTripOfferPolling(intervalMs) {
    let running = false;

    const runAndLog = () => {
        if (running) return;
        running = true;
        refreshTripOffers()
            .then(({ candidateCount, offersCreated, flaggedNoCandidates, offersExpired }) => {
                if (offersCreated > 0 || flaggedNoCandidates > 0 || offersExpired > 0) {
                    console.log(
                        `🚕 Trip offer poll: ${candidateCount} unassigned trip(s) seen — ` +
                        `${offersCreated} new offer(s), ${flaggedNoCandidates} flagged (no drivers), ` +
                        `${offersExpired} expired`
                    );
                }
            })
            .catch(err => console.error("Trip offer poll crashed:", err.message))
            .finally(() => { running = false; });
    };

    runAndLog();
    return setInterval(runAndLog, intervalMs);
}
