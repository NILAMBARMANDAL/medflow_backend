import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true // Makes searching this field in the database highly optimized
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        avatar: {
            type: String, // Cloudinary secure URL string
            required: true
        },
        phoneNumber: {
            type: String,
            required: true,
            trim: true
        },
        role: {
            type: String,
            enum: ["patient", "doctor", "admin"],
            default: "patient",
            required: true
        },
        password: {
            type: String,
            required: [true, "Password is required"]
        },
        refreshToken: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

// 🔒 Pre-save Hook: Hashes the password automatically right before saving it to MongoDB
userSchema.pre("save", async function (next) {
    // Crucial: Only re-hash the password if the user actually modified the password field
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// 🛠️ Custom Instance Method: Checks if the typed password matches the hashed database password
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

// 🎟️ Custom Instance Method: Generates a short-lived Access Token
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            role: this.role // Injected role into the token for immediate access control checks
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    );
};

// 🔄 Custom Instance Method: Generates a long-lived Refresh Token
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    );
};

export const User = mongoose.model("User", userSchema);