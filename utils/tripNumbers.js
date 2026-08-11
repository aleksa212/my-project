import { TripCounter } from "../models/TripCounter.js";
import { ReleasedTripNumber } from "../models/ReleasedTripNumber.js";

/**
 * Atomically claims the next trip number: the smallest released
 * (gap-filling) number if one exists, otherwise the counter's next
 * value. Both branches are single-document Mongo operations, so this
 * is safe under concurrent calls — no two callers can ever receive the
 * same number.
 */
export async function claimNextTripNumber() {
    const released = await ReleasedTripNumber.findOneAndDelete(
        {},
        { sort: { tripNumber: 1 } }
    );
    if (released) return released.tripNumber;

    const counter = await TripCounter.findByIdAndUpdate(
        "tripNumber",
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after" }
    );
    return counter.value;
}

/**
 * Returns a trip number to the gap pool — either a cancelled
 * reservation's number, or one claimed by a "New Reservation" form that
 * was abandoned without saving. Upsert so releasing the same number
 * twice (e.g. a duplicate cleanup call) never throws on the unique index.
 */
export async function releaseTripNumber(tripNumber) {
    if (tripNumber == null) return;
    await ReleasedTripNumber.updateOne(
        { tripNumber },
        { $setOnInsert: { tripNumber } },
        { upsert: true }
    );
}
