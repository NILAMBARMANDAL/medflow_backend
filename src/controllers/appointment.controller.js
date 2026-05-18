import mongoose from "mongoose"; 
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Appointment } from "../models/appointment.model.js";
import { MedicalRecord } from "../models/medicalRecord.model.js";



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
const getUserAppointments = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const userRole = req.user?.role;

  
    const matchField = userRole === "doctor" ? "doctor" : "patient";

    const appointments = await Appointment.aggregate([
        {
            $match: {
                [matchField]: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "users", 
                localField: userRole === "doctor" ? "patient" : "doctor", 
                foreignField: "_id",
                as: "profileDetails"
            }
        },
        {
           
            $unwind: "$profileDetails"
        },
        {
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
const updateAppointmentStatus = asyncHandler(async (req, res) => {
    const { appointmentId, newStatus, prescriptionNotes } = req.body;


    if (!appointmentId || !newStatus) {
        throw new ApiError(400, "Appointment ID and new status are required");
    }

    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Only doctors or admins can perform this action");
    }

    const structuredStatus = newStatus.toLowerCase();

    if (structuredStatus === "completed" && (!prescriptionNotes || prescriptionNotes.trim() === "")) {
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
        appointment.prescriptionNotes = prescriptionNotes;
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
            description: prescriptionNotes,
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