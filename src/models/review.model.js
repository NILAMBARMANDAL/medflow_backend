import mongoose, { Schema } from "mongoose";
import { DoctorProfile } from "./doctorProfile.model.js";

const reviewSchema = new Schema(
    {
        patient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        doctor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        appointment: {
            type: Schema.Types.ObjectId,
            ref: "Appointment",
            required: true,
            unique: true 
        },
        rating: {
            type: Number,
            required: [true, "Please provide a rating between 1 and 5"],
            min: 1,
            max: 5
        },
        comment: {
            type: String,
            required: [true, "Review comment text cannot be blank"],
            trim: true,
            maxLength: [500, "Comments cannot exceed 500 characters"]
        }
    },
    { timestamps: true }
);
reviewSchema.statics.calculateAverageRating = async function (doctorId) {
    const stats = await this.aggregate([
        { $match: { doctor: doctorId } },
        {
            $group: {
                _id: "$doctor",
                nReviews: { $sum: 1 },
                avgRating: { $avg: "$rating" }
            }
        }
    ]);

    if (stats.length > 0) {
        await DoctorProfile.findOneAndUpdate(
            { doctor: doctorId },
            {
                $set: {
                    averageRating: Math.round(stats[0].avgRating * 10) / 10, // Round to 1 decimal place
                    totalReviews: stats[0].nReviews
                }
            }
        );
    } else {
        await DoctorProfile.findOneAndUpdate(
            { doctor: doctorId },
            { $set: { averageRating: 0, totalReviews: 0 } }
        );
    }
};
reviewSchema.post("save", function () {
    this.constructor.calculateAverageRating(this.doctor);
});

export const Review = mongoose.model("Review", reviewSchema);