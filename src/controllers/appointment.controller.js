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

// 2. Fetch User Appointments
const getUserAppointments = asyncHandler(async (req, res) => {
    const appointments = await Appointment.find({ 
        $or: [
            { patient: req.user._id },
            { doctor: req.user._id }
        ]
    })
    .populate("patient", "fullName avatar username email phoneNumber")
    .populate("doctor", "fullName avatar username email phoneNumber");
    
    return res.status(200).json(
        new ApiResponse(200, appointments, "Appointments retrieved successfully")
    );
});

// 3. Update Appointment Status (Pure JSON handler for text note closure)
const updateAppointmentStatus = asyncHandler(async (req, res) => {
    if (!req.body) {
        throw new ApiError(400, "Request payload data body was not received or parsed correctly.");
    }
    
    const { appointmentId, newStatus, prescriptionNotes } = req.body;

    // Safe fallback check to capture any text field variations passed over the body array
    const activeNotes = prescriptionNotes || req.body.notes || req.body.clinicalNotes || "";

    if (!appointmentId || !newStatus) {
        throw new ApiError(400, "Appointment ID and new status are required fields.");
    }

    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Only doctors or admins can perform this action");
    }

    const structuredStatus = newStatus.toLowerCase();

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
    let medicalLockerEntry = null;

    if (structuredStatus === "completed") {
        appointment.prescriptionNotes = activeNotes.trim();
        
        // Log the text note directly inside the health records archive tracker
        medicalLockerEntry = await MedicalRecord.create({
            patient: appointment.patient,
            issuedBy: req.user?._id,
            title: `Digital Prescription (Ref: Appointment #${appointment._id.toString().slice(-4)})`,
            recordType: "Prescription",
            description: activeNotes.trim(),
            attachments: ["system://digital-prescription-text"] 
        });
    } else {
        appointment.prescriptionNotes = ""; 
    }

    await appointment.save();

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