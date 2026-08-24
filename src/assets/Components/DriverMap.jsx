import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const POLL_INTERVAL_MS = 5000;

// Only airport in use today -- just a sane fallback center/zoom before
// any driver locations have loaded in, not meant to mean anything once
// real markers show up (FitBounds takes over from there).
const DEFAULT_CENTER = [45.5152, -122.6784];
const DEFAULT_ZOOM = 10;

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

// Name-labeled pin instead of Leaflet's default marker image -- besides
// matching "appear on the map with their names" directly (no click
// needed to see who's who), it sidesteps the well-known issue where
// Leaflet's default icon image paths don't resolve correctly through a
// bundler like Vite unless separately reconfigured.
function driverIcon(label) {
    return L.divIcon({
        className: "",
        html: `
            <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-50%);">
                <div style="background:#208AEF;color:#fff;font-size:11px;font-weight:600;
                            padding:2px 7px;border-radius:6px;white-space:nowrap;margin-bottom:3px;
                            box-shadow:0 1px 3px rgba(0,0,0,0.35);">
                    ${escapeHtml(label)}
                </div>
                <div style="width:14px;height:14px;border-radius:50%;background:#208AEF;
                            border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>
            </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });
}

// Fits the map to every driver's position once locations first load, but
// deliberately not on every later poll -- re-fitting every 5s would keep
// yanking the view out from under a dispatcher who's manually panned or
// zoomed in on one driver.
function FitBounds({ drivers }) {
    const map = useMap();
    const hasFit = useRef(false);

    useEffect(() => {
        if (hasFit.current || drivers.length === 0) return;
        hasFit.current = true;

        const bounds = L.latLngBounds(drivers.map((d) => [d.location.lat, d.location.lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }, [drivers, map]);

    return null;
}

export default function DriverMap() {
    const navigate = useNavigate();
    const [drivers, setDrivers] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) navigate("/");
    }, [navigate]);

    const fetchDrivers = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const res = await fetch("http://localhost:5000/driver-location", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to load driver locations");

            const data = await res.json();
            setDrivers(data.filter((d) => d.location?.lat != null && d.location?.lng != null));
            setError("");
        } catch (err) {
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        fetchDrivers();
        const interval = setInterval(fetchDrivers, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchDrivers]);

    return (
        <div className="h-screen w-screen flex flex-col">
            <div className="p-2 px-3 bg-gray-100 border-b flex items-center justify-between shrink-0">
                <span className="font-semibold">Driver Map</span>
                <span className="text-sm">
                    {error
                        ? <span className="text-red-600">{error}</span>
                        : <span className="text-gray-600">
                            {drivers.length} driver{drivers.length === 1 ? "" : "s"} live
                        </span>}
                </span>
            </div>

            <div className="flex-1">
                <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <FitBounds drivers={drivers} />
                    {drivers.map((d) => (
                        <Marker
                            key={d._id}
                            position={[d.location.lat, d.location.lng]}
                            icon={driverIcon(d.displayName || d.name)}
                        >
                            <Popup>
                                <div className="font-semibold">{d.displayName || d.name}</div>
                                <div className="text-xs text-gray-500">
                                    Updated {new Date(d.location.updatedAt).toLocaleTimeString()}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}
