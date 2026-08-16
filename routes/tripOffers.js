import express from "express";
import { TripOffer } from "../models/TripOffer.js";
import { Reservation } from "../models/Reservation.js";
import { Driver } from "../models/Driver.js";
import { Vehicle } from "../models/Vehicle.js";
import { getVehicleType } from "../utils/vehicles.js";
import { createLogs } from "../utils/logs.js";

const router = express.Router();

const DRIVER_APP_USER = { firstName: "Driver", lastName: "App" };

/* =============================================
   NO DRIVER-APP AUTH YET
   These routes take a bare `driverId` rather than
   verifying it against a logged-in driver session
   -- there's no driver-facing app or driver auth
   system to check against yet (see the
   conversation this was built from: backend now,
   app later). Anyone who can reach this API can
   currently accept offers on any driver's behalf.
   MUST get real driver authentication in front of
   these two routes before a driver app actually
   goes live with them.
============================================= */

/* ==================== MINE ====================
   What a driver's app would poll: every offer
   still pending that includes this driver, with
   enough trip detail to decide whether to accept.
================================================= */
router.get("/mine", async (req, res) => {
    try {
        const { driverId } = req.query;
        if (!driverId) return res.status(400).json({ error: "driverId is required" });

        const offers = await TripOffer.find({
            status: "pending",
            "offers.driver": driverId
        }).populate("trip");

        const mine = offers
            .filter(o => o.trip) // trip could have been deleted since offering
            .map(o => {
                const own = o.offers.find(x => String(x.driver) === String(driverId));
                return {
                    offerId: o._id,
                    tripId: o.trip._id,
                    tripNumber: o.trip.tripNumber,
                    PUtime: o.trip.PUtime,
                    PUdate: o.trip.PUdate,
                    PUlocation: o.trip.PUlocationName || o.trip.PUlocation,
                    DOlocation: o.trip.DOlocationName || o.trip.DOlocation,
                    PAX: o.trip.PAX,
                    vehicleId: own?.vehicle,
                    lastOfferedAt: o.lastOfferedAt
                };
            });

        res.json(mine);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==================== ACCEPT ====================
   First driver to accept gets it. Race-safety is
   two atomic single-document updates, not a lock:
     1. Claim the OFFER only if it's still "pending"
        -- MongoDB guarantees at most one concurrent
        findOneAndUpdate matching that condition
        succeeds, so two drivers tapping accept at
        the same instant can't both win step 1.
     2. Claim the RESERVATION only if it's still
        "Bidding" (the status the offer engine sets
        when it creates an offer) -- covers the case
        where a dispatcher manually assigned it
        through the normal grid/Auto Dispatch in the
        meantime, which wouldn't have touched the
        offer's own status. If step 2 fails after
        step 1 succeeded, the offer claim is rolled
        back so the trip isn't stuck "accepted" with
        nothing actually assigned.
================================================= */
router.post("/:tripId/accept", async (req, res) => {
    try {
        const { tripId } = req.params;
        const { driverId } = req.body;
        if (!driverId) return res.status(400).json({ error: "driverId is required" });

        const offer = await TripOffer.findOneAndUpdate(
            { trip: tripId, status: "pending", "offers.driver": driverId },
            { status: "accepted", acceptedByDriver: driverId, acceptedAt: new Date() },
            { returnDocument: "after" }
        );

        if (!offer) {
            return res.status(409).json({
                error: "This trip is no longer available (already accepted, expired, or you weren't offered it)."
            });
        }

        const offered = offer.offers.find(o => String(o.driver) === String(driverId));
        const [driver, vehicle] = await Promise.all([
            Driver.findById(driverId),
            Vehicle.findById(offered.vehicle)
        ]);

        if (!driver || !vehicle) {
            // Shouldn't happen (candidates were built from live driver/
            // vehicle docs moments earlier), but if a driver or vehicle
            // got deleted in between, don't leave the offer claimed with
            // nothing to actually assign.
            await TripOffer.updateOne(
                { _id: offer._id },
                { status: "pending", acceptedByDriver: null, acceptedAt: null }
            );
            return res.status(409).json({ error: "Driver or vehicle no longer exists — offer reopened." });
        }

        const reservation = await Reservation.findOne({ _id: tripId });
        if (!reservation) {
            return res.status(404).json({ error: "Trip not found" });
        }

        const updates = {
            Driver: driver.displayName,
            VEHnumber: vehicle.vehicleNumber,
            VEHtype: await getVehicleType(vehicle.vehicleNumber),
            Status: "accepted"
        };

        const updatedReservation = await Reservation.findOneAndUpdate(
            { _id: tripId, Status: "Bidding" },
            {
                // Mongo update documents can't mix plain fields with
                // operators like $push -- everything has to go through
                // $set alongside it once $push is present.
                $set: {
                    ...updates,
                    assignedBy: "driver-app",
                    tripDurationMinutes: null,
                    estimatedDropoff: null
                },
                $push: { logs: { $each: createLogs(reservation, updates, DRIVER_APP_USER) } }
            },
            { returnDocument: "after" }
        );

        if (!updatedReservation) {
            // Someone else (a dispatcher, through the normal grid) already
            // assigned this trip between step 1 and here -- undo the
            // offer claim so it doesn't sit "accepted" pointing at a trip
            // that was actually handled elsewhere.
            await TripOffer.updateOne(
                { _id: offer._id },
                { status: "pending", acceptedByDriver: null, acceptedAt: null }
            );
            return res.status(409).json({ error: "This trip was already assigned by dispatch." });
        }

        res.json(updatedReservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
