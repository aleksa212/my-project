import mongoose from "mongoose";

const LogSchema = new mongoose.Schema(
    {
        field: String,
        oldValue: String,
        newValue: String,
        changedBy: String,
        timestamp: { type: Date, default: Date.now }
    },
    { _id: false }
);

const ReservationSchema = new mongoose.Schema({
    Status: { type: String, default: "Unassigned" },
    assignedBy: { type: String, default: null },

    // Human-facing sequential trip ID (1, 2, 3, ...) — distinct from
    // Mongo's own _id. Claimed atomically via utils/tripNumbers.js
    // *before* a reservation is saved (see reservations.js), and never
    // settable through the update route, so it's effectively immutable
    // in practice; `immutable: true` backs that up at the schema level.
    // Not `required` here because reservations created before this field
    // existed don't have one, and `sparse` keeps the unique index from
    // choking on all those missing values.
    tripNumber: { type: Number, unique: true, sparse: true, immutable: true },

    // Cache of the last-computed PU->DO drive time for this trip, so
    // replaying today's schedule (single-trip auto-dispatch, or a repeat
    // preview) doesn't re-query Google Maps for a trip whose route/timing
    // hasn't changed. Cleared whenever PUlocation/DOlocation/PUdate/PUtime
    // is edited (see reservationRoutes.js).
    tripDurationMinutes: { type: Number, default: null },
    estimatedDropoff: { type: Date, default: null },

    FLTscheduled: String,
    FLTactual: String,
    VEHtype: String,
    VEHnumber: String,
    Driver: String,
    FLTstatus: String,

    // When the FlightAware poller last actually checked this trip's
    // flight — drives the tiered polling interval in
    // utils/flightStatusScheduler.js (checked often close to the
    // flight's time, infrequently far out) so a big schedule change
    // hours out still gets caught promptly without polling everything
    // at the same tight interval regardless of urgency.
    flightLastCheckedAt: { type: Date, default: null },

    Area: String,

    PUlocation: { type: String, required: true },
    PUlocationCode: { type: String, default: "" },
    PUlocationName: { type: String, default: "" },

    DOlocation: { type: String, required: true },
    DOlocationCode: { type: String, default: "" },
    DOlocationName: { type: String, default: "" },

    // Extra addresses visited between pickup and final drop-off, in
    // order -- for non-airport trips where a rider needs multiple stops
    // (a bar crawl, a few errands, etc). Kept as plain address strings
    // like PUlocation/DOlocation, deliberately without their own
    // Code/Name airport-resolution pair since a stop is never itself an
    // airport pickup/dropoff in the flight-tracking sense.
    stops: { type: [String], default: [] },

    PUdate: { type: Date, required: true },
    PUtime: { type: String, required: true },
    FlightNumber: { type: String, required: true },
    PAX: { type: String, required: true },
    DISPnotes: { type: String, required: true },
    TripInfo: { type: String, required: true },
    Account: { type: String, required: true },
    Price: { type: Number, required: true },
    pricing: {
        flatRate: { type: Number, default: 0 },

        perHourRate: { type: Number, default: 0 },
        perHourHours: { type: Number, default: 0 },

        travelFeeRate: { type: Number, default: 0 },
        travelFeeQty: { type: Number, default: 0 },

        waitTimeRate: { type: Number, default: 0 },
        waitTimeQty: { type: Number, default: 0 },

        extraStopRate: { type: Number, default: 0 },
        extraStopQty: { type: Number, default: 0 },

        overtime: { type: Number, default: 0 },
        gratuity: { type: Number, default: 0 },

        stdGratPercent: { type: Number, default: 0 },
        driverPercent: { type: Number, default: 0 },
        stcPercent: { type: Number, default: 0 },

        discountType: { type: String, default: "flat" },
        discountValue: { type: Number, default: 0 },

        airportFee: { type: Number, default: 0 },
        deposit: { type: Number, default: 0 }
    },

    logs: [LogSchema]
});

export const Reservation = mongoose.model("Reservation", ReservationSchema);
export default Reservation;
