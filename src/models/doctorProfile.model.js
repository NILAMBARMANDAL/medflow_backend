import mongoose, { Schema } from "mongoose";

// Sub-schema to handle specific availability slots cleanly
const availabilitySchema = new Schema({
    day: {
        type: String,
        required: true,
        enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    },
    slots: {
        type: [String], // Array of strings representing time slots, e.g., ["09:00 AM", "10:30 AM", "04:00 PM"]
        required: true
    }
}, { _id: false }); 

const doctorProfileSchema = new Schema(
    {
        doctor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true 
        },
        specialization: {
            type: String,
            required: true,
            trim: true,
            index: true 
        },
        experience: {
            type: Number,
            required: true,
            min: [0, "Experience cannot be negative"]
        },
        fees: {
            type: Number, 
            required: true,
            min: [0, "Consultation fees cannot be negative"]
        },
        qualifications: {
            type: [String], 
            required: true
        },
        bio: {
            type: String,
            trim: true,
            maxLength: [500, "Bio cannot exceed 500 characters"]
        },
        medicalCertificate: {
            type: String, 
            required: [true, "Medical registration certificate document is mandatory"]
        },
        isVerified: {
            type: Boolean,
            default: false 
        },
        availability: [availabilitySchema],
        // 🌟 FIXED: Placed cleanly inside the definition object block 🌟
        averageRating: {
            type: Number,
            default: 0,
            min: [0, "Rating cannot be below 0"],
            max: [5, "Rating cannot exceed 5"]
        },
        totalReviews: {
            type: Number,
            default: 0
        }
    }, // 👈 This curly brace now properly terminates all field objects
    {
        timestamps: true
    }
);

export const DoctorProfile = mongoose.model("DoctorProfile", doctorProfileSchema);