import { Field } from "formik";

/* =============================================
   PRICING PANEL
   Right-hand column of the reservation form.
   Purely presentational — all the math comes in
   via the `pricing` prop (see pricingCalculator.jsx),
   computed once per render in NewReservation.jsx
   and shared with the submit handler, so the
   numbers shown here always match what gets saved.
============================================= */
export default function PricingPanel({ pricing, isSubmitting, isEdit }) {
    const {
        perHourTotal,
        travelFeeTotal,
        waitTimeTotal,
        extraStopTotal,
        stdGratTotal,
        driverTotal,
        stcTotal,
        discountTotal,
        grandTotal,
        totalDue
    } = pricing;

    return (
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
                {isEdit ? "Update Reservation" : "Create Reservation"}
            </button>

        </div>
    );
}
