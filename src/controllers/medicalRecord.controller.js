import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { MedicalRecord } from "../models/medicalRecord.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Appointment } from "../models/appointment.model.js"; 

const uploadMedicalRecord = asyncHandler(async (req, res) => {
    const { title, recordType, description, recordDate } = req.body;

    if (!title || !recordType) {
        throw new ApiError(400, "Title and Record Type fields are mandatory.");
    }

    const recordLocalFiles = req.files || [];
    if (recordLocalFiles.length === 0) {
        throw new ApiError(400, "At least one document or image attachment file is required.");
    }


    const uploadedAttachmentsUrls = [];
    for (const file of recordLocalFiles) {
        const uploadedFile = await uploadOnCloudinary(file.path);
        if (uploadedFile?.url) {
            uploadedAttachmentsUrls.push(uploadedFile.url);
        }
    }

    if (uploadedAttachmentsUrls.length === 0) {
        throw new ApiError(500, "Failed to upload attachments to cloud storage engine.");
    }

    const newRecord = await MedicalRecord.create({
        patient: req.user?._id, 
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

const getMyMedicalRecords = asyncHandler(async (req, res) => {
   
    const records = await MedicalRecord.find({ patient: req.user?._id })
        .sort({ recordDate: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, records, "Medical history locker pulled successfully."));
});

const getPatientMedicalRecordsForDoctor = asyncHandler(async (req, res) => {
    const { patientId } = req.params;

    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Only authorized medical personnel can view patient timelines.");
    }

    const hasAppointment = await Appointment.findOne({
        doctor: req.user?._id,
        patient: patientId     
    });

    if (!hasAppointment && req.user?.role !== "admin") {
        throw new ApiError(403, "Unauthorized. You can only view medical records of patients who have booked an appointment with you.");
    }

    const records = await MedicalRecord.find({ patient: patientId }).sort({ recordDate: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, records, "Patient medical history retrieved successfully."));
});

export {
    uploadMedicalRecord,
    getMyMedicalRecords,
    getPatientMedicalRecordsForDoctor
};