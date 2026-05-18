// 📑 src/models/appointment.model.js
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
            ref: "User",
            required: true
        },
        appointmentDate: {
            type: Date,
            required: true
        },
        reasonForVisit: {
            type: String,
            required: true,
            trim: true
        },
        status: {
            type: String,
            enum: ["pending", "scheduled", "completed", "cancelled"],
            default: "pending",
            required: true
        },
        prescriptionNotes: {
            type: String,
            default: ""
        },
        prescriptionUrl: { // 🎯 FIXED: Relocated inside the core fields block
            type: String, 
            default: ""
        }
    },
    {
        timestamps: true
    }
);

export const Appointment = mongoose.model("Appointment", appointmentSchema);