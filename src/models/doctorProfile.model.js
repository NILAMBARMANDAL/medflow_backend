import mongoose, { Schema } from "mongoose";

const doctorProfileSchema = new Schema(
    {
        doctor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true // One user profile per doctor account
        },
        specialization: {
            type: String,
            required: true,
            trim: true,
            index: true // Optimized for rapid search by specialty on the frontend
        },
        experienceInYears: {
            type: Number,
            required: true,
            min: 0
        },
        qualifications: [
            {
                type: String, // e.g., ["MBBS", "MD Cardiology"]
                required: true
            }
        ],
        consultationFee: {
            type: Number,
            required: true,
            min: 0
        },
        availableDays: [
            {
                type: String, // e.g., ["Monday", "Wednesday", "Friday"]
                enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            }
        ],
        clinicTimings: {
            start: { type: String, required: true }, // e.g., "09:00 AM"
            end: { type: String, required: true }    // e.g., "05:00 PM"
        },
        isAvailableForBooking: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

export const DoctorProfile = mongoose.model("DoctorProfile", doctorProfileSchema);