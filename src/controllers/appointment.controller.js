import mongoose from "mongoose"; // 👈 CRITICAL: Added to handle manual ObjectId conversions
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Appointment } from "../models/appointment.model.js";

// ⚡ FEATURE 1: Book an Appointment (Unchanged, completely solid)
const bookAppointment = asyncHandler(async (req, res) => {
    const { doctorId, appointmentDate, reasonForVisit } = req.body;

    if (!doctorId || !appointmentDate || !reasonForVisit) {
        throw new ApiError(400, "All fields (doctorId, appointmentDate, reasonForVisit) are required");
    }

    const appointment = await Appointment.create({
        patient: req.user?._id,
        doctor: doctorId,
        appointmentDate,
        reasonForVisit,
        status: "pending"
    });

    if (!appointment) {
        throw new ApiError(500, "Something went wrong while booking the appointment");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, appointment, "Appointment booked successfully"));
});

// ⚡ REFACTORED FEATURE 2: Get Appointments via Aggregation Pipeline
// WHY: Instead of returning raw IDs, this links and shapes our data in one clean database pass.
const getUserAppointments = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const userRole = req.user?.role;

    // Pick which field to match based on who is logged in
    const matchField = userRole === "doctor" ? "doctor" : "patient";

    const appointments = await Appointment.aggregate([
        {
            // STAGE 1: Match appointments belonging to the logged-in user
            // We must wrap the ID in new mongoose.Types.ObjectId() or the aggregation won't match anything!
            $match: {
                [matchField]: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            // STAGE 2: SQL-style JOIN with the users collection
            // If I am the doctor, look up the patient's profile data (and vice-versa)
            $lookup: {
                from: "users", // Must match the exact name of the collection in MongoDB Atlas
                localField: userRole === "doctor" ? "patient" : "doctor", 
                foreignField: "_id",
                as: "profileDetails"
            }
        },
        {
            // STAGE 3: Flatten the profile details array into a clean object
            $unwind: "$profileDetails"
        },
        {
            // STAGE 4: Project and secure the final data shape
            // 1 means keep the field; 0 means exclude it. This strips out passwords completely!
            $project: {
                _id: 1,
                appointmentDate: 1,
                reasonForVisit: 1,
                status: 1,
                prescriptionNotes: 1,
                createdAt: 1,
                "profileDetails.fullName": 1,
                "profileDetails.email": 1,
                "profileDetails.avatar": 1,
                "profileDetails.phoneNumber": 1
            }
        },
        {
            // STAGE 5: Sort by closest upcoming appointment date
            $sort: {
                appointmentDate: 1
            }
        }
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                appointments, 
                "Detailed dashboard appointments retrieved successfully"
            )
        );
});

// ⚡ FEATURE 3: Update Status (Unchanged, completely solid)
const updateAppointmentStatus = asyncHandler(async (req, res) => {
    const { appointmentId, newStatus, prescriptionNotes } = req.body;

    if (!appointmentId || !newStatus) {
        throw new ApiError(400, "Appointment ID and new status are required");
    }

    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Only doctors or admins can perform this action");
    }

    if (newStatus === "completed" && (!prescriptionNotes || prescriptionNotes.trim() === "")) {
        throw new ApiError(400, "Prescription notes are mandatory when completing an appointment");
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        {
            $set: {
                status: newStatus,
                prescriptionNotes: newStatus === "completed" ? prescriptionNotes : ""
            }
        },
        { returnDocument: 'after' }
    );

    if (!updatedAppointment) {
        throw new ApiError(404, "Appointment not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedAppointment, `Appointment status updated to ${newStatus}`));
});

export {
    bookAppointment,
    getUserAppointments,
    updateAppointmentStatus
};