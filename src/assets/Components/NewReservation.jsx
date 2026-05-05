import { Formik, Form, Field, ErrorMessage } from 'formik';
import { normalizeToCode } from "./Airports";

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
        PAX: selectedReservation?.PAX || "",
        DISPnotes: selectedReservation?.DISPnotes || "",
        TripInfo: selectedReservation?.TripInfo || "",
        Account: selectedReservation?.Account || "",
        Price: selectedReservation?.Price || ""
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">

            {/* BACKDROP */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={() => {
                    setReservationOpen(false);
                    setSelectedReservation(null);
                }}
            />

            {/* MODAL */}
            <div className="relative z-10 bg-white w-full max-w-md p-6 rounded-lg shadow-xl">

                <h1 className="text-lg font-semibold mb-4">
                    {selectedReservation ? "Edit Reservation" : "New Reservation"}
                </h1>

                <Formik
                    enableReinitialize
                    initialValues={initialValues}
                    onSubmit={async (values, { setSubmitting }) => {
                        try {
                            const isEdit = !!selectedReservation;

                            const url = isEdit
                                ? `http://localhost:5000/reservations/${selectedReservation._id}`
                                : "http://localhost:5000/reservations";

                            const method = isEdit ? "PUT" : "POST";

                            const res = await fetch(url, {
                                method,
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    ...values,
                                    PUlocation: normalizeToCode(values.PUlocation),
                                    DOlocation: normalizeToCode(values.DOlocation)
                                })
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
                    {({ isSubmitting }) => (
                        <Form className="flex flex-col gap-3">

                            <Field
                                type="text"
                                name="Area"
                                className="border p-2 rounded"
                                placeholder="Area"
                            />
                            <ErrorMessage name="Area" component="div" className="text-red-500 text-sm" />

                            <Field
                                type="text"
                                name="PUlocation"
                                className="border p-2 rounded"
                                placeholder="PU location"
                            />
                            <ErrorMessage name="PUlocation" component="div" className="text-red-500 text-sm" />

                            <Field
                                type="text"
                                name="DOlocation"
                                className="border p-2 rounded"
                                placeholder="DO location"
                            />
                            <ErrorMessage name="DOlocation" component="div" className="text-red-500 text-sm" />

                            <Field
                                type="date"
                                name="PUdate"
                                className="border p-2 rounded"
                            />
                            <ErrorMessage name="PUdate" component="div" className="text-red-500 text-sm" />

                            <Field
                                type="time"
                                name="PUtime"
                                className="border p-2 rounded"
                            />
                            <ErrorMessage name="PUtime" component="div" className="text-red-500 text-sm" />

                            <Field
                                type="text"
                                name="FlightNumber"
                                className="border p-2 rounded"
                                placeholder="Flight Number"
                            />
                            <ErrorMessage name="FlightNumber" component="div" className="text-red-500 text-sm" />

                            <Field
                                type="text"
                                name="PAX"
                                className="border p-2 rounded"
                                placeholder="PAX#"
                            />
                            <ErrorMessage name="PAX" component="div" className="text-red-500 text-sm" />

                            <Field
                                as="textarea"
                                name="DISPnotes"
                                className="border p-2 rounded"
                                placeholder="Notes"
                            />
                            <ErrorMessage name="DISPnotes" component="div" className="text-red-500 text-sm" />

                            <Field
                                as="select"
                                name="TripInfo"
                                className="border p-2 rounded"
                            >
                                <option value="">Select type</option>
                                <option value="Add On">Add On</option>
                                <option value="Manifest">Manifest</option>
                            </Field>
                            <ErrorMessage name="TripInfo" component="div" className="text-red-500 text-sm" />

                            <Field
                                as="select"
                                name="Account"
                                className="border p-2 rounded"
                            >
                                <option value="">Select account</option>
                                <option value="Southwest unscheduled">Southwest unscheduled</option>
                                <option value="American Airlines unscheduled">American Airlines unscheduled</option>
                            </Field>
                            <ErrorMessage name="Account" component="div" className="text-red-500 text-sm" />

                            <Field
                                type="text"
                                name="Price"
                                className="border p-2 rounded"
                                placeholder="Price $"
                            />
                            <ErrorMessage name="Price" component="div" className="text-red-500 text-sm" />

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-orange-500 text-white p-2 rounded hover:bg-orange-600"
                            >
                                {selectedReservation ? "Update Reservation" : "Create Reservation"}
                            </button>

                        </Form>
                    )}
                </Formik>
            </div>
        </div>
    );
};

export default NewReservation;