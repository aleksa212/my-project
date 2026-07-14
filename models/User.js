import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: { type: String, unique: true },
    password: String,

    savedFilters: [
        {
            name: String,
            airports: [String]
        }
    ]
});

export const User = mongoose.model("User", UserSchema);
export default User;
