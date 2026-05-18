import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Review } from "../models/review.model.js";
import { Appointment } from "../models/appointment.model.js";

const addDoctorReview = asyncHandler(async (req, res) => {
    const { appointmentId, rating, comment } = req.body;

    
    if (!appointmentId || !rating || !comment) {
        throw new ApiError(400, "Appointment ID, rating score, and a comment are required.");
    }

    if (rating < 1 || rating > 5) {
        throw new ApiError(400, "Rating score must fall strictly within the 1 to 5 tier system.");
    }

    const appointment = await Appointment.findOne({
        _id: appointmentId,
        patient: req.user?._id,
        status: "completed"
    });

    if (!appointment) {
        throw new ApiError(403, "Access Denied. You can only review doctors after a consultation appointment is marked completed.");
    }

    const existingReview = await Review.findOne({ appointment: appointmentId });
    if (existingReview) {
        throw new ApiError(409, "You have already submitted a review comment for this specific appointment session.");
    }

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
const getDoctorReviews = asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const { page = 1, limit = 5 } = req.query; 
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