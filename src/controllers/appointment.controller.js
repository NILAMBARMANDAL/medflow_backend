// 📑 src/controllers/appointment.controller.js
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Appointment } from "../models/appointment.model.js";
import { MedicalRecord } from "../models/medicalRecord.model.js";

// 1. Book an Appointment Session
const bookAppointment = asyncHandler(async (req, res) => {
    const { doctorId, appointmentDate, reasonForVisit } = req.body;

    if (!doctorId || !appointmentDate || !reasonForVisit) {
        throw new ApiError(400, "All fields (doctorId, appointmentDate, reasonForVisit) are required");
    }

    
    const slotCollision = await Appointment.findOne({
        doctor: doctorId,
        appointmentDate: appointmentDate,
        status: { $in: ["pending", "scheduled"] }
    });

    if (slotCollision) {
        throw new ApiError(409, "This time slot has already been reserved for this provider. Please select another slot.");
    }

    // The real guarantee: the unique partial index on (doctor, appointmentDate) atomically
    // prevents double-booking even under concurrent requests that both pass the check above.
    let appointment;
    try {
        appointment = await Appointment.create({
            patient: req.user?._id,
            doctor: doctorId,
            appointmentDate,
            reasonForVisit,
            status: "pending"
        });
    } catch (error) {
        // MongoDB duplicate-key error code — the unique index rejected a racing double-booking.
        if (error.code === 11000) {
            throw new ApiError(409, "This time slot has already been reserved for this provider. Please select another slot.");
        }
        throw error; // any other error bubbles up to the global error handler
    }

    if (!appointment) {
        throw new ApiError(500, "Something went wrong while booking the appointment");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, appointment, "Appointment booked successfully"));
});

// 2. Fetch User Appointments (With Dynamic Review Verification)
const getUserAppointments = asyncHandler(async (req, res) => {
    // Step A: Fetch base appointment records matching the current user context
    const appointments = await Appointment.find({
        $or: [
            { patient: req.user._id },
            { doctor: req.user._id }
        ]
    })
    .populate("patient", "fullName avatar username email phoneNumber")
    .populate("doctor", "fullName avatar username email phoneNumber");

    // Step B: Look up the Reviews model to cross-reference completed submissions
    const ReviewModel = mongoose.models.Review || mongoose.model("Review");
    const existingUserReviews = await ReviewModel.find({ patient: req.user._id });

    // Map reviewed documents down to a clean array of string IDs
    const reviewedAppointmentIds = existingUserReviews.map(rev => rev.appointment.toString());

    // Step C: Enhance the payload array with the live evaluation boolean flag state
    const enhancedAppointments = appointments.map(appt => {
        const apptObj = appt.toObject(); // Cast document down to mutable object literal
        apptObj.isReviewed = reviewedAppointmentIds.includes(appt._id.toString());
        return apptObj;
    });

    return res.status(200).json(
        new ApiResponse(200, enhancedAppointments, "Appointments retrieved successfully")
    );
});

// 3. Update Appointment Status (Standard Text-Only Closure Input Pipeline)
const updateAppointmentStatus = asyncHandler(async (req, res) => {
    if (!req.body) {
        throw new ApiError(400, "Request payload data body was not received or parsed correctly.");
    }
    const { appointmentId, newStatus, prescriptionNotes } = req.body;

    if (!appointmentId || !newStatus) {
        throw new ApiError(400, "Appointment ID and new status are required fields.");
    }

    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Only doctors or admins can perform this action");
    }

    const structuredStatus = newStatus.toLowerCase();
    const activeNotes = prescriptionNotes || req.body.notes || req.body.clinicalNotes || "";

    if (structuredStatus === "completed" && (!activeNotes || activeNotes.trim() === "")) {
        throw new ApiError(400, "Prescription notes are mandatory when completing an appointment");
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
        throw new ApiError(404, "Appointment record not found");
    }

    if (appointment.doctor.toString() !== req.user?._id.toString() && req.user?.role !== "admin") {
        throw new ApiError(403, "Unauthorized. You are not the assigned medical practitioner for this appointment.");
    }

    if (appointment.status === "completed") {
        throw new ApiError(400, "This appointment has already been completed and closed.");
    }

    appointment.status = structuredStatus;
    if (structuredStatus === "completed") {
        appointment.prescriptionNotes = activeNotes.trim();
    } else {
        appointment.prescriptionNotes = "";
    }
    await appointment.save();

    let medicalLockerEntry = null;
    if (structuredStatus === "completed") {
        medicalLockerEntry = await MedicalRecord.create({
            patient: appointment.patient,
            issuedBy: req.user?._id,
            title: `Digital Prescription (Ref: Appointment #${appointment._id.toString().slice(-4)})`,
            recordType: "Prescription",
            description: activeNotes.trim(),
            attachments: ["system://digital-prescription-text"]
        });
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { appointment, medicalLockerEntry },
                `Appointment status successfully updated to ${structuredStatus}`
            )
        );
});

export {
    bookAppointment,
    getUserAppointments,
    updateAppointmentStatus
};