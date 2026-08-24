import { useCallback, useEffect, useState } from "react";

export function useReservations({
    refreshKey,
    page = 1,
    limit = 100,
    searchText = "",
    idSearch = "",
    selectedDate = "",
    airportFilter = []
} = {}) {
    const [rowData, setRowData] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);

    // ======================
    // FETCH ONE PAGE OF RESERVATIONS
    // Filtering/searching now happens server-side (see routes/
    // reservations.js) rather than over the full collection in the
    // browser -- necessary once the collection is in the thousands, since
    // re-fetching and re-filtering everything on every keystroke doesn't
    // stay fast at that size.
    // ======================
    const airportFilterKey = airportFilter.join(",");

    const buildQuery = useCallback(() => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (searchText) params.set("search", searchText);
        if (idSearch) params.set("idSearch", idSearch);
        // Mirrors the old client-side rule: an ID search overrides the
        // date filter rather than combining with it.
        if (!idSearch && selectedDate) params.set("date", selectedDate);
        if (airportFilterKey) params.set("airportFilter", airportFilterKey);
        return params;
    }, [page, limit, searchText, idSearch, selectedDate, airportFilterKey]);

    // Shared by the initial/filter-driven fetch, the imperative
    // post-mutation re-fetch (copyTrip/removeTrip), and the background
    // poll below -- `showLoading` is false only for the poll, so a
    // driver-app status change appearing in the background never
    // flashes the "Loading…" footer text or otherwise interrupts
    // whatever the dispatcher is doing.
    const fetchReservations = useCallback((showLoading = true) => {
        if (showLoading) setLoading(true);
        return fetch(`http://localhost:5000/reservations?${buildQuery().toString()}`)
            .then(res => res.json())
            .then(({ data, total, totalPages }) => {
                setRowData(data || []);
                setTotal(total || 0);
                setTotalPages(totalPages || 1);
            })
            .catch(console.error)
            .finally(() => { if (showLoading) setLoading(false); });
    }, [buildQuery]);

    useEffect(() => {
        fetchReservations(true);
    }, [refreshKey, fetchReservations]);

    // Background poll so a driver accepting/declining/advancing a trip
    // from the driver app shows up here without the dispatcher having to
    // manually refresh. Simple interval rather than websockets/SSE --
    // this project has no push-notification infra yet, and a table that
    // updates a few seconds later is fine for how it's actually used.
    // Restarts on filter/page change since buildQuery changes.
    const POLL_INTERVAL_MS = 8000;
    useEffect(() => {
        const interval = setInterval(() => fetchReservations(false), POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchReservations]);

    // Used by copyTrip/removeTrip below to re-sync this page with the
    // server after a mutation, rather than guessing the correct local
    // patch (which page a new/removed row belongs on isn't knowable
    // client-side once results are paginated).
    const fetchPage = useCallback(() => fetchReservations(true), [fetchReservations]);

    // ======================
    // COPY TRIP
    // ======================
    const copyTrip = async (trip) => {
        try {
            const { _id, id: _unusedId, tripNumber: _unusedTripNumber, ...rest } = trip;

            const token = localStorage.getItem("token");
            const idRes = await fetch("http://localhost:5000/reservations/next-trip-id", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            const { tripNumber: newTripNumber } = await idRes.json();

            const copiedTrip = {
                ...rest,
                tripNumber: newTripNumber,
                Status: "Unassigned"
            };

            const res = await fetch("http://localhost:5000/reservations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(copiedTrip)
            });

            const data = await res.json();

            // Where the copy actually belongs (which page, given current
            // sort/filters) isn't something to guess client-side anymore
            // -- re-fetch this page from the server instead of prepending
            // locally, so the count and page contents both stay correct.
            await fetchPage();

            return data;
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    // ======================
    // UPDATE DISPATCH NOTES
    // ======================
    const updateDispatchNotes = async (reservation, notes) => {
        try {
            const updated = {
                ...reservation,
                DISPnotes: notes
            };

            const res = await fetch(
                `http://localhost:5000/reservations/${reservation._id || reservation.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(updated)
                }
            );

            const saved = await res.json();

            setRowData(prev =>
                prev.map(r =>
                    (r._id || r.id) === (saved._id || saved.id)
                        ? saved
                        : r
                )
            );

            return saved;
        } catch (err) {
            console.error("Update notes failed:", err);
        }
    };

    // ======================
    // REMOVE (DELETE) TRIP
    // Distinct from setting Status: "Cancelled" (which keeps the record
    // visible in the grid, just marked as cancelled) -- this actually
    // deletes the reservation and frees its trip ID back into the gap
    // pool server-side (see reservations.js DELETE route) so the next
    // new reservation fills it before the counter grows any further.
    // Currently available to anyone with grid access; the plan is to
    // restrict it to specific permitted accounts later on.
    // ======================
    const removeTrip = async (reservation) => {
        try {
            const id = reservation._id || reservation.id;
            const token = localStorage.getItem("token");

            await fetch(`http://localhost:5000/reservations/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            // Re-fetch rather than filter locally -- keeps the total
            // count accurate and pulls in whatever row now fills this
            // page from the server instead of leaving it one short.
            await fetchPage();
        } catch (err) {
            console.error("Remove failed:", err);
        }
    };

    return {
        rowData,
        setRowData,
        total,
        totalPages,
        loading,
        copyTrip,
        updateDispatchNotes,
        removeTrip
    };
}