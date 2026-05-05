import { useState, useEffect } from "react";
import { Header } from "./assets/Components/Header";
import { Table } from "./assets/Components/Table";
import NewReservation from "./assets/Components/NewReservation";
import { useNavigate } from "react-router-dom";

function App() {
  const [searchText, setSearchText] = useState("");
  const [idSearch, setIdSearch] = useState("");

  const [reservationOpen, setReservationOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ======================
  // AIRPORT FILTER (Step 3+5)
  // ======================
  const [airportFilter, setAirportFilter] = useState([]);

  // ======================
  // SAVED FILTERS (Step 7)
  // ======================
  const [savedFilters, setSavedFilters] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const navigate = useNavigate();

  // ======================
  // AUTH CHECK
  // ======================
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    const fetchFilters = async () => {
      const token = localStorage.getItem("token");

      if (!token) return;

      const res = await fetch("http://localhost:5000/filters", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      setSavedFilters(data);
    };

    fetchFilters();
  }, []);


  return (
    <>
      {reservationOpen && (
        <NewReservation
          setReservationOpen={setReservationOpen}
          selectedReservation={selectedReservation}
          setSelectedReservation={setSelectedReservation}
          setRefreshKey={setRefreshKey}
        />
      )}

      {/* ======================
                HEADER (controls everything)
            ====================== */}
      <Header
        searchText={searchText}
        setSearchText={setSearchText}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        idSearch={idSearch}
        setIdSearch={setIdSearch}
        setReservationOpen={setReservationOpen}
        airportFilter={airportFilter}
        setAirportFilter={setAirportFilter}
        savedFilters={savedFilters}
        setSavedFilters={setSavedFilters}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
      />

      {/* ======================
                TABLE (only consumes filters)
            ====================== */}
      <Table
        searchText={searchText}
        selectedDate={selectedDate}
        idSearch={idSearch}
        setSelectedReservation={setSelectedReservation}
        setReservationOpen={setReservationOpen}
        refreshKey={refreshKey}
        airportFilter={airportFilter}
      />
    </>
  );
}

export default App;