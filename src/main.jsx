import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./assets/Components/Login.jsx";
import SignUpForm from "./assets/Components/SignUpForm.jsx";
import App from "./App.jsx";
import DriverMap from "./assets/Components/DriverMap.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignUpForm />} />
        <Route path="/app" element={<App />} />
        <Route path="/map" element={<DriverMap />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
