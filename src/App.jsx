import { useState, useEffect } from "react";
import { Header } from "./assets/Components/Header";
import { Table } from "./assets/Components/Table";
import NewReservation from "./assets/Components/NewReservation";
import { useNavigate } from "react-router-dom";
import { DriversProvider } from "./assets/Components/DriversContext";
import { VehiclesProvider } from "./assets/Components/VehiclesContext";

function App() {
  const [searchText, setSearchText] = useState("");
  const [idSearch, setIdSearch] = useState("");

  const [reservationOpen, setReservationOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [airportFilter, setAirportFilter] = useState([]);

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
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      setSavedFilters(data);
    };

    fetchFilters();
  }, []);

  return (
    <DriversProvider>
      <VehiclesProvider>
        <div className="h-screen overflow-hidden flex flex-col">
          {reservationOpen && (
            <NewReservation
              setReservationOpen={setReservationOpen}
              selectedReservation={selectedReservation}
              setSelectedReservation={setSelectedReservation}
              setRefreshKey={setRefreshKey}
            />
          )}

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
            setRefreshKey={setRefreshKey}
          />

          <Table
            searchText={searchText}
            selectedDate={selectedDate}
            idSearch={idSearch}
            setSelectedReservation={setSelectedReservation}
            setReservationOpen={setReservationOpen}
            refreshKey={refreshKey}
            setRefreshKey={setRefreshKey}
            airportFilter={airportFilter}
          />
        </div>
      </VehiclesProvider>
    </DriversProvider>
  );
}

export default App;