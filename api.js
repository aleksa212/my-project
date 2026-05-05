const API_URL = "http://localhost:5000";

export const apiFetch = async (endpoint, options = {}) => {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
    });

    // optional: auto-handle errors
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "API request failed");
    }

    return res.json();
};