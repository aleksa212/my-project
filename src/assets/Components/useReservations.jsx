import { useEffect, useState } from "react";

export function useReservations(refreshKey) {
    const [rowData, setRowData] = useState([]);

    // ======================
    // FETCH ALL RESERVATIONS
    // ======================
    useEffect(() => {
        fetch("http://localhost:5000/reservations")
            .then(res => res.json())
            .then(setRowData)
            .catch(console.error);
    }, [refreshKey]);

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

            setRowData(prev => [data, ...prev]);

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
    // CANCEL (DELETE) TRIP
    // Frees the trip's ID back into the gap pool server-side (see
    // reservations.js DELETE route) so the next new reservation fills
    // it before the counter grows any further.
    // ======================
    const cancelTrip = async (reservation) => {
        try {
            const id = reservation._id || reservation.id;
            const token = localStorage.getItem("token");

            await fetch(`http://localhost:5000/reservations/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            setRowData(prev => prev.filter(r => (r._id || r.id) !== id));
        } catch (err) {
            console.error("Cancel failed:", err);
        }
    };

    return {
        rowData,
        setRowData,
        copyTrip,
        updateDispatchNotes,
        cancelTrip
    };
}