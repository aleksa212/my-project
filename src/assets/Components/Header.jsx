import { airportMap } from "./Airports";
import { useState } from "react";
import DriversModal from "./DriversModal";
import VehiclesModal from "./VehiclesModal";
import AutoDispatchModal from "./AutoDispatchModal";

export function Header({
    searchText,
    setSearchText,
    selectedDate,
    setSelectedDate,
    idSearch,
    setIdSearch,
    setReservationOpen,
    airportFilter,
    setAirportFilter,
    savedFilters,
    setSavedFilters,
    activeFilter,
    setActiveFilter,
    setRefreshKey
}) {

    const [deleteMode, setDeleteMode] = useState(false);
    const [filterToDelete, setFilterToDelete] = useState(null);
    const [driversOpen, setDriversOpen] = useState(false);
    const [vehiclesOpen, setVehiclesOpen] = useState(false);
    const [autoDispatchOpen, setAutoDispatchOpen] = useState(false);

    const airports = Object.keys(airportMap);

    const saveFilter = async () => {
        const name = prompt("Filter name?");
        if (!name) return;

        const token = localStorage.getItem("token");

        const res = await fetch("http://localhost:5000/filters", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name, airports: airportFilter })
        });

        const data = await res.json();
        setSavedFilters(data);

        setAirportFilter([]);
        setActiveFilter(null);
    };

    const clearFilters = () => {
        setSearchText("");
        setIdSearch("");
        setSelectedDate(() => {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        });

        setAirportFilter([]);
        setActiveFilter(null);
    };

    return (
        <div className="mb-2 flex flex-wrap gap-2 items-center">

            <input
                className="p-1 border-2 border-solid rounded-sm border-gray-200 hover:border-black"
                type="text"
                placeholder="Search"
                value={searchText || ""}
                onChange={(e) => setSearchText(e.target.value)}
            />

            <input
                className="p-1 border-2 border-solid rounded-sm border-gray-200 hover:border-black"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
            />

            <input
                className="p-1 border-2 border-solid rounded-sm border-gray-200 hover:border-black"
                type="text"
                placeholder="Search by ID"
                value={idSearch}
                onChange={(e) => setIdSearch(e.target.value)}
            />

            <select
                className="p-1 border rounded"
                onChange={(e) => {
                    const code = e.target.value;
                    if (!code) return;

                    setAirportFilter(prev => {
                        if (prev.includes(code)) return prev;
                        return [...prev, code];
                    });

                    e.target.value = "";
                }}
            >
                <option value="">+ Airport Filter</option>
                {airports.map(code => (
                    <option key={code} value={code}>{code}</option>
                ))}
            </select>

            <button className="p-1 border rounded bg-blue-200 hover:bg-blue-300" onClick={saveFilter}>
                Save Filter
            </button>

            <button className="p-1 border rounded bg-red-200 hover:bg-red-300" onClick={() => setDeleteMode(true)}>
                Delete Filter
            </button>

            <select
                className="p-1 border rounded"
                value={activeFilter || ""}
                onChange={(e) => {
                    const name = e.target.value;
                    if (!name) return;

                    const selected = savedFilters.find(f => f.name === name);
                    if (!selected) return;

                    setAirportFilter(selected.airports);
                    setActiveFilter(name);
                }}
            >
                <option value="">Saved Filters</option>
                {savedFilters.map(f => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                ))}
            </select>

            <button className="p-1 border rounded bg-gray-200 hover:bg-gray-300" onClick={clearFilters}>
                Clear Filters
            </button>

            <button
                className="p-1 rounded-sm border-0 bg-orange-500 hover:shadow-xl hover:bg-orange-600 text-white"
                onClick={() => setReservationOpen(true)}
            >
                New Res
            </button>

            <button
                className="p-1 rounded-sm border-0 bg-teal-600 hover:shadow-xl hover:bg-teal-700 text-white"
                onClick={() => setDriversOpen(true)}
            >
                Drivers
            </button>

            <button
                className="p-1 rounded-sm border-0 bg-cyan-600 hover:shadow-xl hover:bg-cyan-700 text-white"
                onClick={() => setVehiclesOpen(true)}
            >
                Vehicles
            </button>

            <button
                className="p-1 rounded-sm border-0 bg-indigo-600 hover:shadow-xl hover:bg-indigo-700 text-white"
                onClick={() => setAutoDispatchOpen(true)}
            >
                Auto Dispatch
            </button>

            <div className="flex gap-2 flex-wrap w-full mt-2">
                {airportFilter.map(code => (
                    <span
                        key={code}
                        className="px-2 py-1 bg-blue-100 rounded cursor-pointer"
                        onClick={() => setAirportFilter(prev => prev.filter(c => c !== code))}
                    >
                        {code} ✕
                    </span>
                ))}
            </div>

            {deleteMode && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow p-4 w-[350px]">
                        <div className="font-semibold mb-3">Delete Saved Filter</div>

                        <select
                            className="p-2 border rounded w-full"
                            onChange={(e) => {
                                const selected = savedFilters.find(f => f.name === e.target.value);
                                setFilterToDelete(selected);
                            }}
                        >
                            <option value="">Choose filter</option>
                            {savedFilters.map(f => (
                                <option key={f.name} value={f.name}>{f.name}</option>
                            ))}
                        </select>

                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                className="px-3 py-1 bg-gray-200 rounded"
                                onClick={() => { setDeleteMode(false); setFilterToDelete(null); }}
                            >
                                Cancel
                            </button>

                            <button
                                className="px-3 py-1 bg-red-500 text-white rounded"
                                disabled={!filterToDelete}
                                onClick={async () => {
                                    if (!filterToDelete) return;

                                    const confirmDelete = window.confirm(`Delete filter "${filterToDelete.name}"?`);
                                    if (!confirmDelete) return;

                                    const token = localStorage.getItem("token");

                                    const res = await fetch(
                                        `http://localhost:5000/filters/${filterToDelete.name}`,
                                        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
                                    );

                                    const data = await res.json();
                                    setSavedFilters(data);

                                    setFilterToDelete(null);
                                    setDeleteMode(false);

                                    if (activeFilter === filterToDelete.name) {
                                        setActiveFilter(null);
                                        setAirportFilter([]);
                                    }
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {driversOpen && (
                <DriversModal onClose={() => setDriversOpen(false)} />
            )}

            {vehiclesOpen && (
                <VehiclesModal onClose={() => setVehiclesOpen(false)} />
            )}

            {autoDispatchOpen && (
                <AutoDispatchModal
                    onClose={() => setAutoDispatchOpen(false)}
                    onCommitted={() => setRefreshKey(prev => prev + 1)}
                />
            )}
        </div>
    );
}