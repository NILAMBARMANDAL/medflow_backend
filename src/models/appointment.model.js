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
        prescriptionUrl: { 
            type: String, 
            default: ""
        }
    },
    {
        timestamps: true
    }
);
appointmentSchema.index(
    { doctor: 1, appointmentDate: 1 },
    {
        unique: true,
        partialFilterExpression: { status: { $in: ["pending", "scheduled"] } }
    }
);
export const Appointment = mongoose.model("Appointment", appointmentSchema);