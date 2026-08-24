import jwt from "jsonwebtoken";
import { Driver } from "../models/Driver.js";

// Parallel to middleware/auth.js but scoped to Driver records instead of
// User (dispatcher) records -- a driver's JWT and a dispatcher's JWT
// share the same signing secret and {id} shape, but each middleware
// looks the id up in its own collection, so a token minted for one
// side simply won't resolve to anything on the other.
export const driverAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({ message: "No token provided" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const driver = await Driver.findById(decoded.id);

        if (!driver) {
            return res.status(401).json({ message: "Driver not found" });
        }

        req.driver = driver;
        next();
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }
};

export default driverAuth;
