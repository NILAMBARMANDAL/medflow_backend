import mongoose, { Schema } from "mongoose";

const appointmentSchema = new Schema(
    {
        patient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        doctor: {
            type: Schema.Types.ObjectId,
            ref: "User", // Points to the user entry where role === "doctor"
            required: true,
            index: true
        },
        appointmentDate: {
            type: Date,
            required: true
        },
        timeSlot: {
            type: String, // e.g., "10:30 AM - 10:45 AM"
            required: true
        },
        status: {
            type: String,
            enum: ["Pending", "Confirmed", "Cancelled", "Completed"],
            default: "Pending",
            required: true
        },
        // ⚡ Concurrency Control: Combined unique string to prevent double-booking
        // Format: "doctorID_dateString_timeSlot" (e.g., "doc123_2026-05-20_10:30AM")
        // Setting unique: true creates an iron-clad database constraint against race conditions!
        slotLockId: {
            type: String,
            required: true,
            unique: true
        },
        // 📊 The Predictive Analytics Layer:
        // Stores the waiting calculation derived from your ML tracking microservice
        predictedWaitTimeInMins: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

export const Appointment = mongoose.model("Appointment", appointmentSchema);