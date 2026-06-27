import { Formik, Form, Field, ErrorMessage } from 'formik';
import CreatableSelect from 'react-select/creatable';
import { normalizeToCode, areaLocations } from "./Airports";

const areaOptions = Object.keys(areaLocations).map((code) => ({
    value: code,
    label: code
}));

// Convert a stored string value into a react-select option object
const toOption = (val) => (val ? { value: val, label: val } : null);

// Given an area code, return the dropdown options for that area.
// If no area is selected, return all locations across all areas.
const getLocationOptions = (area) => {
    if (area && areaLocations[area]) {
        return areaLocations[area];
    }
    return Object.values(areaLocations).flat();
};

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

    const calculateTotalDue = (values) => {
        const num = (v) => Number(v || 0);

        const perHourTotal = num(values.perHourRate) * num(values.perHourHours);
        const travelFeeTotal = num(values.travelFeeRate) * num(values.travelFeeQty);
        const waitTimeTotal = num(values.waitTimeRate) * num(values.waitTimeQty);
        const extraStopTotal = num(values.extraStopRate) * num(values.extraStopQty);

        const subtotalBeforePercents =
            num(values.flatRate) +
            perHourTotal +
            travelFeeTotal +
            waitTimeTotal +
            extraStopTotal +
            num(values.overtime) +
            num(values.gratuity) +
            num(values.airportFee);

        const stdGratTotal =
            subtotalBeforePercents * (num(values.stdGratPercent) / 100);

        const driverTotal =
            subtotalBeforePercents * (num(values.driverPercent) / 100);

        const stcTotal =
            subtotalBeforePercents * (num(values.stcPercent) / 100);

        let totalBeforeDiscount =
            subtotalBeforePercents +
            stdGratTotal +
            driverTotal +
            stcTotal;

        let discountTotal =
            values.discountType === "percent"
                ? totalBeforeDiscount * (num(values.discountValue) / 100)
                : num(values.discountValue);

        const grandTotal = totalBeforeDiscount - discountTotal;

        const totalDue = grandTotal - num(values.deposit);

        return totalDue;
    };

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

                            const totalDue = calculateTotalDue(values);

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

                        const num = (v) => Number(v || 0);

                        const perHourTotal =
                            num(values.perHourRate) * num(values.perHourHours);

                        const travelFeeTotal =
                            num(values.travelFeeRate) * num(values.travelFeeQty);

                        const waitTimeTotal =
                            num(values.waitTimeRate) * num(values.waitTimeQty);

                        const extraStopTotal =
                            num(values.extraStopRate) * num(values.extraStopQty);

                        const subtotalBeforePercents =
                            num(values.flatRate) +
                            perHourTotal +
                            travelFeeTotal +
                            waitTimeTotal +
                            extraStopTotal +
                            num(values.overtime) +
                            num(values.gratuity) +
                            num(values.airportFee);

                        const stdGratTotal =
                            subtotalBeforePercents *
                            (num(values.stdGratPercent) / 100);

                        const driverTotal =
                            subtotalBeforePercents *
                            (num(values.driverPercent) / 100);

                        const stcTotal =
                            subtotalBeforePercents *
                            (num(values.stcPercent) / 100);

                        let totalBeforeDiscount =
                            subtotalBeforePercents +
                            stdGratTotal +
                            driverTotal +
                            stcTotal;

                        let discountTotal = 0;

                        if (values.discountType === "percent") {
                            discountTotal =
                                totalBeforeDiscount *
                                (num(values.discountValue) / 100);
                        } else {
                            discountTotal = num(values.discountValue);
                        }

                        const grandTotal =
                            totalBeforeDiscount - discountTotal;

                        const totalDue =
                            grandTotal - num(values.deposit);

                        // Location options for PU/DO based on selected area
                        const locationOptions = getLocationOptions(values.Area);

                        return (
                            <Form className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* LEFT SIDE */}
                                <div className="md:col-span-1 flex flex-col gap-3">

                                    {/* =====================
                                        AREA (airport code select)
                                    ===================== */}
                                    <div>
                                        <CreatableSelect
                                            options={areaOptions}
                                            value={values.Area ? { value: values.Area, label: values.Area } : null}
                                            onChange={(selected) => {
                                                setFieldValue("Area", selected?.value || "");
                                            }}
                                            isClearable
                                            placeholder="Select Area (airport code)"
                                            formatCreateLabel={(input) => `Use area: "${input}"`}
                                            styles={selectStyles}
                                        />
                                    </div>

                                    {/* =====================
                                        PU LOCATION
                                    ===================== */}
                                    <div>
                                        <CreatableSelect
                                            options={locationOptions}
                                            value={toOption(values.PUlocation)}
                                            onChange={(selected) =>
                                                setFieldValue("PUlocation", selected?.value || "")
                                            }
                                            isClearable
                                            placeholder="PU location — pick from list or type custom address"
                                            formatCreateLabel={(input) => `Use address: "${input}"`}
                                            noOptionsMessage={() => "Select an Area above to see options, or type a custom address"}
                                            styles={selectStyles}
                                        />
                                    </div>

                                    {/* =====================
                                        DO LOCATION
                                    ===================== */}
                                    <div>
                                        <CreatableSelect
                                            options={locationOptions}
                                            value={toOption(values.DOlocation)}
                                            onChange={(selected) =>
                                                setFieldValue("DOlocation", selected?.value || "")
                                            }
                                            isClearable
                                            placeholder="DO location — pick from list or type custom address"
                                            formatCreateLabel={(input) => `Use address: "${input}"`}
                                            noOptionsMessage={() => "Select an Area above to see options, or type a custom address"}
                                            styles={selectStyles}
                                        />
                                    </div>

                                    <Field
                                        type="date"
                                        name="PUdate"
                                        className="border p-2 rounded"
                                    />

                                    <Field
                                        type="time"
                                        name="PUtime"
                                        className="border p-2 rounded"
                                    />

                                    <Field
                                        type="text"
                                        name="FlightNumber"
                                        className="border p-2 rounded"
                                        placeholder="Flight Number"
                                    />

                                    <Field
                                        type="text"
                                        name="PAX"
                                        className="border p-2 rounded"
                                        placeholder="PAX#"
                                    />

                                    <Field
                                        as="textarea"
                                        name="DISPnotes"
                                        className="border p-2 rounded"
                                        placeholder="Notes"
                                    />

                                    <Field
                                        as="select"
                                        name="TripInfo"
                                        className="border p-2 rounded"
                                    >
                                        <option value="">Select type</option>
                                        <option value="Add On">Add On</option>
                                        <option value="Manifest">Manifest</option>
                                    </Field>

                                    <Field
                                        as="select"
                                        name="Account"
                                        className="border p-2 rounded"
                                    >
                                        <option value="">Select account</option>
                                        <option value="Southwest unscheduled">
                                            Southwest unscheduled
                                        </option>
                                        <option value="American Airlines unscheduled">
                                            American Airlines unscheduled
                                        </option>
                                    </Field>

                                </div>

                                {/* RIGHT SIDE PRICE PANEL */}
                                <div className="md:col-span-1 border rounded-lg p-4 bg-gray-50 h-fit">

                                    <h2 className="font-semibold text-lg mb-4">
                                        Pricing
                                    </h2>

                                    <div className="space-y-1">

                                        {/* Flat Rate */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                Flat Rate
                                            </label>

                                            <Field
                                                type="number"
                                                name="flatRate"
                                                className="border p-1 rounded w-20 text-right"
                                                placeholder="0.00"
                                            />
                                        </div>

                                        {/* Per Hour */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                Per Hour
                                            </label>

                                            <div className="flex items-center gap-2">
                                                <Field
                                                    type="number"
                                                    name="perHourRate"
                                                    className="border p-1 rounded w-20 text-right"
                                                />

                                                <span className="text-gray-500">×</span>

                                                <Field
                                                    type="number"
                                                    name="perHourHours"
                                                    className="border p-1 rounded w-20 text-right"
                                                />

                                                <span className="text-gray-500">=</span>

                                                <div className="border p-1 rounded w-20 text-right bg-gray-100">
                                                    {perHourTotal.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Travel Fee */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                Travel Fee
                                            </label>

                                            <div className="flex items-center gap-2">
                                                <Field
                                                    type="number"
                                                    name="travelFeeRate"
                                                    className="border p-1 rounded w-20 text-right"
                                                />

                                                <span className="text-gray-500">×</span>

                                                <Field
                                                    type="number"
                                                    name="travelFeeQty"
                                                    className="border p-1 rounded w-20 text-right"
                                                />

                                                <span className="text-gray-500">=</span>

                                                <div className="border p-1 rounded w-20 text-right bg-gray-100">
                                                    {travelFeeTotal.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Wait time */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                Wait Time
                                            </label>

                                            <div className="flex items-center gap-2">
                                                <Field
                                                    type="number"
                                                    name="waitTimeRate"
                                                    className="border p-1 rounded w-20 text-right"
                                                />

                                                <span className="text-gray-500">×</span>

                                                <Field
                                                    type="number"
                                                    name="waitTimeQty"
                                                    className="border p-1 rounded w-20 text-right"
                                                />

                                                <span className="text-gray-500">=</span>

                                                <div className="border p-1 rounded w-20 text-right bg-gray-100">
                                                    {waitTimeTotal.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Extra stops */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                Extra Stops
                                            </label>

                                            <div className="flex items-center gap-2">
                                                <Field
                                                    type="number"
                                                    name="extraStopRate"
                                                    className="border p-1 rounded w-20 text-right"
                                                />

                                                <span className="text-gray-500">×</span>

                                                <Field
                                                    type="number"
                                                    name="extraStopQty"
                                                    className="border p-1 rounded w-20 text-right"
                                                />

                                                <span className="text-gray-500">=</span>

                                                <div className="border p-1 rounded w-20 text-right bg-gray-100">
                                                    {extraStopTotal.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* OT/Wait time */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                OT/Wait time
                                            </label>

                                            <Field
                                                type="number"
                                                name="overtime"
                                                className="border p-1 rounded w-20 text-right"
                                                placeholder="0.00"
                                            />
                                        </div>

                                        {/* Gratuity */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                Gratuity
                                            </label>

                                            <Field
                                                type="number"
                                                name="gratuity"
                                                className="border p-1 rounded w-20 text-right"
                                                placeholder="0.00"
                                            />
                                        </div>

                                        {/* Std Grat */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                Std Grat
                                            </label>

                                            <Field
                                                type="number"
                                                name="stdGratPercent"
                                                className="border p-1 rounded w-20 text-right"
                                            />

                                            <span>%</span>

                                            <span>=</span>

                                            <div className="border p-1 rounded w-20 text-right bg-gray-100">
                                                {stdGratTotal.toFixed(2)}
                                            </div>
                                        </div>

                                        {/* Discount */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                Discount
                                            </label>

                                            <div className="flex items-center gap-2">

                                                <Field
                                                    as="select"
                                                    name="discountType"
                                                    className="border p-1 rounded"
                                                >
                                                    <option value="flat">$</option>
                                                    <option value="percent">%</option>
                                                </Field>

                                                <Field
                                                    type="number"
                                                    name="discountValue"
                                                    className="border p-1 rounded w-20 text-right"
                                                />

                                                <span>=</span>

                                                <div className="border p-1 rounded w-20 text-right bg-gray-100">
                                                    {discountTotal.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Driver Fee */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                Driver %
                                            </label>

                                            <Field
                                                type="number"
                                                name="driverPercent"
                                                className="border p-1 rounded w-20 text-right"
                                            />

                                            <span>%</span>

                                            <span>=</span>

                                            <div className="border p-1 rounded w-20 text-right bg-gray-100">
                                                {driverTotal.toFixed(2)}
                                            </div>
                                        </div>

                                        {/* STC */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                STC
                                            </label>

                                            <Field
                                                type="number"
                                                name="stcPercent"
                                                className="border p-1 rounded w-20 text-right"
                                            />

                                            <span>%</span>

                                            <span>=</span>

                                            <div className="border p-1 rounded w-20 text-right bg-gray-100">
                                                {stcTotal.toFixed(2)}
                                            </div>
                                        </div>

                                        {/* Airport Fee */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium w-24">
                                                Airport Fee
                                            </label>

                                            <Field
                                                type="number"
                                                name="airportFee"
                                                className="border p-1 rounded w-20 text-right"
                                                placeholder="0.00"
                                            />
                                        </div>

                                        <hr className="my-4" />

                                        {/* TOTALS */}
                                        <div className="space-y-2">

                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold text-green-700">
                                                    Grand Total
                                                </span>

                                                <div className="border rounded px-3 py-2 bg-white min-w-[110px] text-right font-bold text-green-700">
                                                    ${grandTotal.toFixed(2)}
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold text-blue-700">
                                                    Deposit
                                                </span>

                                                <Field
                                                    type="number"
                                                    name="deposit"
                                                    className="border p-2 rounded w-28 text-right"
                                                />
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold text-red-700">
                                                    Total Due
                                                </span>

                                                <div className="border rounded px-3 py-2 bg-white min-w-[110px] text-right font-bold text-red-700">
                                                    ${totalDue.toFixed(2)}
                                                </div>
                                            </div>

                                        </div>

                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full mt-6 bg-orange-500 text-white p-2 rounded hover:bg-orange-600"
                                    >
                                        {selectedReservation
                                            ? "Update Reservation"
                                            : "Create Reservation"}
                                    </button>

                                </div>
                            </Form>
                        );
                    }}
                </Formik>
            </div>
        </div>
    );
};

// Shared react-select styles to match the rest of the form
const selectStyles = {
    control: (base) => ({
        ...base,
        borderRadius: "0.25rem",
        borderColor: "#d1d5db",
        minHeight: "42px",
        boxShadow: "none",
        "&:hover": { borderColor: "#000" }
    }),
    menu: (base) => ({
        ...base,
        zIndex: 9999
    }),
    option: (base, state) => ({
        ...base,
        fontSize: "0.875rem",
        backgroundColor: state.isFocused ? "#f3f4f6" : "white",
        color: "#111827"
    }),
    placeholder: (base) => ({
        ...base,
        fontSize: "0.875rem",
        color: "#9ca3af"
    }),
    singleValue: (base) => ({
        ...base,
        fontSize: "0.875rem"
    })
};

export default NewReservation;
