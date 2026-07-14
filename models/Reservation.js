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

    Area: String,

    PUlocation: { type: String, required: true },
    PUlocationCode: { type: String, default: "" },
    PUlocationName: { type: String, default: "" },

    DOlocation: { type: String, required: true },
    DOlocationCode: { type: String, default: "" },
    DOlocationName: { type: String, default: "" },

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
