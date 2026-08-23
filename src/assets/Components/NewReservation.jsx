import { useEffect, useRef, useState } from 'react';
import { Formik, Form } from 'formik';
import { calculatePricing } from "./PricingCalculator";
import TripDetailsFields from "./TripDetailsFields";
import PricingPanel from "./PricingPanel";

const releaseTripId = (tripNumber) => {
    const token = localStorage.getItem("token");
    // keepalive lets this request survive a page unload/reload -- without
    // it, a plain fetch() gets aborted mid-flight the moment the tab
    // closes or refreshes, so the release never lands and the number
    // stays stuck as "claimed" forever even though nothing used it.
    fetch("http://localhost:5000/reservations/release-trip-id", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tripNumber }),
        keepalive: true
    }).catch(() => {});
};

const NewReservation = ({
    setReservationOpen,
    selectedReservation,
    setSelectedReservation,
    setRefreshKey
}) => {
    const isEdit = !!selectedReservation;

    // New reservations claim a trip number the moment this form opens,
    // so the ID shown here is exactly what gets saved -- not a preview
    // that might change. Editing an existing trip just displays its
    // already-assigned number.
    const [tripNumber, setTripNumber] = useState(selectedReservation?.tripNumber ?? null);
    const [claimingId, setClaimingId] = useState(!isEdit);
    const [claimError, setClaimError] = useState("");
    const tripNumberRef = useRef(null);
    const savedRef = useRef(false);
    const closedRef = useRef(false);
    // Survives React StrictMode's dev-only double-invoke of this effect
    // (mount -> cleanup -> remount, synchronously) so the throwaway first
    // pass can't fire a second real claim request -- unlike a `cancelled`
    // flag scoped to one invocation, this ref is shared across both.
    const hasClaimStartedRef = useRef(false);

    const releaseIfUnsaved = () => {
        closedRef.current = true;
        if (!savedRef.current && tripNumberRef.current != null) {
            releaseTripId(tripNumberRef.current);
        }
    };

    useEffect(() => {
        if (isEdit || hasClaimStartedRef.current) return;
        hasClaimStartedRef.current = true;

        const token = localStorage.getItem("token");

        fetch("http://localhost:5000/reservations/next-trip-id", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                tripNumberRef.current = data.tripNumber;
                if (closedRef.current) {
                    // Form was already closed before the claim came back --
                    // release it immediately rather than leaving it stranded.
                    if (!savedRef.current) releaseTripId(data.tripNumber);
                    return;
                }
                setTripNumber(data.tripNumber);
                setClaimingId(false);
            })
            .catch(() => {
                setClaimError("Could not assign a trip ID");
                setClaimingId(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A hard page reload/close doesn't reliably run a normal event
    // handler, but it does fire beforeunload first -- this is the
    // deterministic place to catch that specific case. The X button and
    // successful-submit paths call releaseIfUnsaved directly instead of
    // relying on effect-cleanup-on-unmount, since that's exactly what
    // fires unpredictably under StrictMode's double-invoke.
    useEffect(() => {
        window.addEventListener("beforeunload", releaseIfUnsaved);
        return () => window.removeEventListener("beforeunload", releaseIfUnsaved);
    }, []);

    const initialValues = {
        PUlocation: selectedReservation?.PUlocation || '',
        DOlocation: selectedReservation?.DOlocation || '',
        stops: selectedReservation?.stops || [],
        Area: selectedReservation?.Area || "",
        PUdate: selectedReservation?.PUdate
            ? new Date(selectedReservation.PUdate).toISOString().split("T")[0]
            : "",
        PUtime: selectedReservation?.PUtime || "",
        FlightNumber: selectedReservation?.FlightNumber || "",
        PAX: selectedReservation?.PAX || "",
        DISPnotes: selectedReservation?.DISPnotes || "",
        TripInfo: selectedReservation?.TripInfo || "",
        Account: selectedReservation?.Account || "",

        flatRate: selectedReservation?.pricing?.flatRate ?? 0,

        perHourRate: selectedReservation?.pricing?.perHourRate ?? 0,
        perHourHours: selectedReservation?.pricing?.perHourHours ?? 0,

        travelFeeRate: selectedReservation?.pricing?.travelFeeRate ?? 0,
        travelFeeQty: selectedReservation?.pricing?.travelFeeQty ?? 0,

        waitTimeRate: selectedReservation?.pricing?.waitTimeRate ?? 0,
        waitTimeQty: selectedReservation?.pricing?.waitTimeQty ?? 0,

        extraStopRate: selectedReservation?.pricing?.extraStopRate ?? 0,
        extraStopQty: selectedReservation?.pricing?.extraStopQty ?? 0,

        overtime: selectedReservation?.pricing?.overtime ?? 0,
        gratuity: selectedReservation?.pricing?.gratuity ?? 0,

        stdGratPercent: selectedReservation?.pricing?.stdGratPercent ?? 0,
        driverPercent: selectedReservation?.pricing?.driverPercent ?? 0,
        stcPercent: selectedReservation?.pricing?.stcPercent ?? 0,

        discountType: selectedReservation?.pricing?.discountType ?? "flat",
        discountValue: selectedReservation?.pricing?.discountValue ?? 0,

        airportFee: selectedReservation?.pricing?.airportFee ?? 0,
        deposit: selectedReservation?.pricing?.deposit ?? 0
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">

            {/* BACKDROP */}
            <div className="absolute inset-0 bg-black/50" />

            {/* MODAL */}
            <div className="relative z-10 bg-white w-full max-w-5xl p-6 rounded-lg shadow-xl">

                <button
                    onClick={() => {
                        releaseIfUnsaved();
                        setReservationOpen(false);
                        setSelectedReservation(null);
                    }}
                    className="absolute top-3 right-3 text-gray-500 hover:text-black cursor-pointer text-xl font-bold"
                >
                    ✕
                </button>

                <div className="absolute top-3 left-6 text-sm font-mono text-gray-500">
                    {claimingId
                        ? "Trip ID: assigning…"
                        : claimError
                            ? <span className="text-red-500">{claimError}</span>
                            : tripNumber != null
                                ? `Trip ID: ${tripNumber}`
                                : null}
                </div>

                <h1 className="text-lg font-semibold mb-4 mt-4">
                    {isEdit ? "Edit Reservation" : "New Reservation"}
                </h1>

                <Formik
                    enableReinitialize
                    initialValues={initialValues}
                    onSubmit={async (values, { setSubmitting }) => {
                        try {
                            const url = isEdit
                                ? `http://localhost:5000/reservations/${selectedReservation._id}`
                                : "http://localhost:5000/reservations";

                            const method = isEdit ? "PUT" : "POST";

                            const { totalDue } = calculatePricing(values);

                            const {
                                flatRate,
                                perHourRate,
                                perHourHours,
                                travelFeeRate,
                                travelFeeQty,
                                waitTimeRate,
                                waitTimeQty,
                                extraStopRate,
                                extraStopQty,
                                overtime,
                                gratuity,
                                stdGratPercent,
                                driverPercent,
                                stcPercent,
                                discountType,
                                discountValue,
                                airportFee,
                                deposit,
                                ...rest
                            } = values;

                            const payload = {
                                ...rest,

                                Price: totalDue,
                                ...(isEdit ? {} : { tripNumber }),

                                pricing: {
                                    flatRate,
                                    perHourRate,
                                    perHourHours,
                                    travelFeeRate,
                                    travelFeeQty,
                                    waitTimeRate,
                                    waitTimeQty,
                                    extraStopRate,
                                    extraStopQty,
                                    overtime,
                                    gratuity,
                                    stdGratPercent,
                                    driverPercent,
                                    stcPercent,
                                    discountType,
                                    discountValue,
                                    airportFee,
                                    deposit
                                }
                            };

                            const token = localStorage.getItem("token");

                            const res = await fetch(url, {
                                method,
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${token}`
                                },
                                body: JSON.stringify(payload)
                            });

                            const data = await res.json();
                            console.log("Saved:", data);

                            if (res.ok) savedRef.current = true;

                            setRefreshKey(prev => prev + 1);

                        } catch (err) {
                            console.error(err);
                        }

                        // No-op if the save actually succeeded (savedRef
                        // guards it) -- but if it failed, this makes sure
                        // the claimed ID doesn't stay stuck since it was
                        // never actually consumed by a real reservation.
                        releaseIfUnsaved();

                        setSubmitting(false);
                        setReservationOpen(false);
                        setSelectedReservation(null);
                    }}
                >
                    {({ values, isSubmitting, setFieldValue }) => {
                        const pricing = calculatePricing(values);

                        return (
                            <Form className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <TripDetailsFields
                                    values={values}
                                    setFieldValue={setFieldValue}
                                />

                                <PricingPanel
                                    pricing={pricing}
                                    isSubmitting={isSubmitting || (!isEdit && tripNumber == null)}
                                    isEdit={isEdit}
                                />
                            </Form>
                        );
                    }}
                </Formik>
            </div>
        </div>
    );
};

export default NewReservation;
