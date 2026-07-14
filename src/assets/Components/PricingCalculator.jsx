/* =============================================
   PRICING CALCULATOR
   Single source of truth for the reservation
   pricing math. Previously this same formula was
   written twice in NewReservation.jsx — once in
   the submit handler, once again inline in the
   render for the live totals — which meant a rule
   change in one place could silently drift out of
   sync with the other. Both call sites now call
   this one function.
============================================= */
export function calculatePricing(values) {
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

    const totalBeforeDiscount =
        subtotalBeforePercents + stdGratTotal + driverTotal + stcTotal;

    const discountTotal =
        values.discountType === "percent"
            ? totalBeforeDiscount * (num(values.discountValue) / 100)
            : num(values.discountValue);

    const grandTotal = totalBeforeDiscount - discountTotal;
    const totalDue = grandTotal - num(values.deposit);

    return {
        perHourTotal,
        travelFeeTotal,
        waitTimeTotal,
        extraStopTotal,
        subtotalBeforePercents,
        stdGratTotal,
        driverTotal,
        stcTotal,
        totalBeforeDiscount,
        discountTotal,
        grandTotal,
        totalDue
    };
}

export default calculatePricing;
