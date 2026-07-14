import mongoose from "mongoose";

/* ==================== DB ==================== */

export const connectDB = () => {
    mongoose
        .connect(process.env.MONGO_URI)
        .then(() => console.log("✅ MongoDB Atlas connected"))
        .catch((err) => console.log("DB Error:", err));
};

export default connectDB;
