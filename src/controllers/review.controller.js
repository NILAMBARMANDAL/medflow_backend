import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Review } from "../models/review.model.js";
import { Appointment } from "../models/appointment.model.js";

// ⚡ FEATURE 1: Add a Doctor Review
// WHY: Verified patients can leave rating scores and textual critiques regarding their consultations.
const addDoctorReview = asyncHandler(async (req, res) => {
    const { appointmentId, rating, comment } = req.body;

    // 1. Inputs Verification Check
    if (!appointmentId || !rating || !comment) {
        throw new ApiError(400, "Appointment ID, rating score, and a comment are required.");
    }

    if (rating < 1 || rating > 5) {
        throw new ApiError(400, "Rating score must fall strictly within the 1 to 5 tier system.");
    }

    // 2. 🛡️ Verification Gate: Confirm appointment exists, belongs to this patient, and is COMPLETED
    const appointment = await Appointment.findOne({
        _id: appointmentId,
        patient: req.user?._id,
        status: "completed"
    });

    if (!appointment) {
        throw new ApiError(403, "Access Denied. You can only review doctors after a consultation appointment is marked completed.");
    }

    // 3. Prevent duplicate fraud reviews for the same appointment slot
    const existingReview = await Review.findOne({ appointment: appointmentId });
    if (existingReview) {
        throw new ApiError(409, "You have already submitted a review comment for this specific appointment session.");
    }

    // 4. Save Review
    const review = await Review.create({
        patient: req.user?._id,
        doctor: appointment.doctor,
        appointment: appointmentId,
        rating: Number(rating),
        comment
    });

    return res
        .status(201)
        .json(new ApiResponse(201, review, "Review and rating successfully logged to the doctor's profile dashboard."));
});

// ⚡ FEATURE 2: Fetch Public Reviews for a Specific Doctor
// 📑 src/controllers/review.controller.js

const getDoctorReviews = asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const { page = 1, limit = 5 } = req.query; // Default to small batches of 5 reviews

    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const skipValue = (pageNumber - 1) * limitNumber;

    const reviews = await Review.find({ doctor: doctorId })
        .populate("patient", "fullName avatar")
        .sort({ createdAt: -1 })
        .skip(skipValue)
        .limit(limitNumber);

    const totalReviewsCount = await Review.countDocuments({ doctor: doctorId });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                {
                    reviews,
                    currentPage: pageNumber,
                    totalPages: Math.ceil(totalReviewsCount / limitNumber),
                    totalReviewsCount
                }, 
                "Paginated comment feedback timeline populated cleanly."
            )
        );
});
export { addDoctorReview, getDoctorReviews };