import { Formik, Form } from 'formik';
import { calculatePricing } from "./PricingCalculator";
import TripDetailsFields from "./TripDetailsFields";
import PricingPanel from "./PricingPanel";

const NewReservation = ({
    setReservationOpen,
    selectedReservation,
    setSelectedReservation,
    setRefreshKey
}) => {

    const initialValues = {
        PUlocation: selectedReservation?.PUlocation || '',
        DOlocation: selectedReservation?.DOlocation || '',
        Area: selectedReservation?.Area || "",
        PUdate: selectedReservation?.PUdate
            ? new Date(selectedReservation.PUdate).toISOString().split("T")[0]
            : "",
        PUtime: selectedReservation?.PUtime || "",
        FlightNumber: selectedReservation?.FlightNumber || "",
        FLTscheduled: selectedReservation?.FLTscheduled || "",
        FLTactual: selectedReservation?.FLTactual || "",
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

    const isEdit = !!selectedReservation;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">

            {/* BACKDROP */}
            <div className="absolute inset-0 bg-black/50" />

            {/* MODAL */}
            <div className="relative z-10 bg-white w-full max-w-5xl p-6 rounded-lg shadow-xl">

                <button
                    onClick={() => {
                        setReservationOpen(false);
                        setSelectedReservation(null);
                    }}
                    className="absolute top-3 right-3 text-gray-500 hover:text-black cursor-pointer text-xl font-bold"
                >
                    ✕
                </button>

                <h1 className="text-lg font-semibold mb-4">
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

                            setRefreshKey(prev => prev + 1);

                        } catch (err) {
                            console.error(err);
                        }

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
                                    isSubmitting={isSubmitting}
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
