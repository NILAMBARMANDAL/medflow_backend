import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { MedicalRecord } from "../models/medicalRecord.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Appointment } from "../models/appointment.model.js"; // 👈 Cleanly moved to the top!

// ⚡ FEATURE 1: Upload a New Medical Record
// WHY: Patients need to upload documents, lab entries, or prescriptions to their timeline.
const uploadMedicalRecord = asyncHandler(async (req, res) => {
    const { title, recordType, description, recordDate } = req.body;

    // 1. Base Text Validation Check
    if (!title || !recordType) {
        throw new ApiError(400, "Title and Record Type fields are mandatory.");
    }

    // 2. Capture Multiple Files from Multer Stream
    const recordLocalFiles = req.files || [];
    if (recordLocalFiles.length === 0) {
        throw new ApiError(400, "At least one document or image attachment file is required.");
    }

    // 3. Sequential Cloudinary Upload Loop
    const uploadedAttachmentsUrls = [];
    for (const file of recordLocalFiles) {
        const uploadedFile = await uploadOnCloudinary(file.path);
        if (uploadedFile?.url) {
            uploadedAttachmentsUrls.push(uploadedFile.url);
        }
    }

    // Double check that our cloud push succeeded
    if (uploadedAttachmentsUrls.length === 0) {
        throw new ApiError(500, "Failed to upload attachments to cloud storage engine.");
    }

    // 4. Save Record to MongoDB linked directly to the logged-in user
    const newRecord = await MedicalRecord.create({
        patient: req.user?._id, // Securely grabbed from verifyJWT session tracker
        title,
        recordType,
        description: description || "",
        recordDate: recordDate || undefined,
        attachments: uploadedAttachmentsUrls
    });

    return res
        .status(201)
        .json(new ApiResponse(201, newRecord, "Medical record added to health locker timeline successfully."));
});

// ⚡ FEATURE 2: Get History Timeline (Self View)
// WHY: Patients need to pull their full health history dashboard chronologically.
const getMyMedicalRecords = asyncHandler(async (req, res) => {
    // Sorts chronologically by recordDate (-1 means newest records show up first)
    const records = await MedicalRecord.find({ patient: req.user?._id })
        .sort({ recordDate: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, records, "Medical history locker pulled successfully."));
});

// ⚡ FEATURE 3: Get Patient History Timeline (Doctor View with Security Gate)
// WHY: Doctors need to review a patient's medical history, but only if they have an appointment.
const getPatientMedicalRecordsForDoctor = asyncHandler(async (req, res) => {
    const { patientId } = req.params;

    // 1. 🛡️ Role-Based Restriction
    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Only authorized medical personnel can view patient timelines.");
    }

    // 2. Security Check: Validate active/past appointment context
    const hasAppointment = await Appointment.findOne({
        doctor: req.user?._id,
        patient: patientId     
    });

    if (!hasAppointment && req.user?.role !== "admin") {
        throw new ApiError(403, "Unauthorized. You can only view medical records of patients who have booked an appointment with you.");
    }

    // 3. Complete structural retrieval
    const records = await MedicalRecord.find({ patient: patientId }).sort({ recordDate: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, records, "Patient medical history retrieved successfully."));
});

// 🌟 FIXED: Unified into ONE single export statement block
export {
    uploadMedicalRecord,
    getMyMedicalRecords,
    getPatientMedicalRecordsForDoctor
};