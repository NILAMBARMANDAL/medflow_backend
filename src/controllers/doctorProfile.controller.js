import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { DoctorProfile } from "../models/doctorProfile.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";
import { Appointment } from "../models/appointment.model.js";
// ⚡ FEATURE 1: Update Doctor Profile
// WHY: Verified or onboarded doctors need to modify their fees, bio, or calendar slots dynamically over time.
const createOrUpdateDoctorProfile = asyncHandler(async (req, res) => {
    const { specialization, experience, fees, qualifications, bio, availability } = req.body;

    // 1. 🛡️ Role-Based Authorization Guard
    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Only doctor accounts can manage a professional profile");
    }

    // 2. Fetch the certificate file path from Multer stream if updated
    const certificateLocalPath = req.file?.path;

    // If it's a completely new profile initialization, a certificate is strictly mandatory
    const existingProfile = await DoctorProfile.findOne({ doctor: req.user?._id });
    if (!existingProfile && !certificateLocalPath) {
        throw new ApiError(400, "Official medical registration certificate document is required for onboarding");
    }

    // 3. Upload to Cloudinary CDN if a fresh file buffer is intercepted
    let certificateUrl = existingProfile?.medicalCertificate;
    if (certificateLocalPath) {
        const uploadedFile = await uploadOnCloudinary(certificateLocalPath);
        if (!uploadedFile.url) {
            throw new ApiError(400, "Failed to upload medical certificate to Cloudinary");
        }
        certificateUrl = uploadedFile.url;
    }

    // 4. Update or Insert the profile parameters securely
    const profile = await DoctorProfile.findOneAndUpdate(
        { doctor: req.user?._id },
        {
            $set: {
                doctor: req.user?._id,
                specialization,
                experience: experience !== undefined ? Number(experience) : existingProfile?.experience,
                fees: fees !== undefined ? Number(fees) : existingProfile?.fees,
                qualifications: typeof qualifications === "string" ? JSON.parse(qualifications) : qualifications,
                bio: bio || "",
                availability: typeof availability === "string" ? JSON.parse(availability) : availability,
                medicalCertificate: certificateUrl
                // 🛡️ Note: 'isVerified' flag is intentionally excluded here to prevent privilege escalation exploits.
            }
        },
        { upsert: true, returnDocument: 'after', runValidators: true }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, profile, "Doctor credentials updated successfully and queued for verification reviews"));
});

// ⚡ FEATURE 2: Get Self Profile (Dashboard View)
const getMyDoctorProfile = asyncHandler(async (req, res) => {
    // Populates core user records (fullName, email, avatar, phoneNumber) alongside profile statistics
    const profile = await DoctorProfile.findOne({ doctor: req.user?._id }).populate(
        "doctor", 
        "fullName email avatar phoneNumber"
    );

    if (!profile) {
        throw new ApiError(404, "No professional profile details documented for this account yet");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, profile, "Professional dashboard statistics pulled successfully"));
});

// ⚡ FEATURE 3: Admin Doctor Verification Gate
// WHY: Admins need a dedicated control panel path to approve or revoke doctor credentials.
const verifyDoctorProfile = asyncHandler(async (req, res) => {
    const { doctorId } = req.params; // Captures the target doctor's user ID from the URL path
    const { status } = req.body;     // True to approve, false to revoke/reject

    // 1. 🛡️ Strict Admin Authorization Check
    if (req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Only system administrators can authorize doctor accounts.");
    }

    // 2. Validate incoming body parameters
    if (status === undefined) {
        throw new ApiError(400, "Verification status flag is required in the request body.");
    }

    // 3. Find the profile and update the verification field
    const profile = await DoctorProfile.findOneAndUpdate(
        { doctor: doctorId },
        { $set: { isVerified: status } },
        { 
            new: true,           // Returns the updated profile document
            runValidators: true  
        }
    ).populate("doctor", "fullName email role");

    if (!profile) {
        throw new ApiError(404, "No doctor profile found mapping to the provided user ID.");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                profile, 
                status 
                    ? "Doctor credentials reviewed and approved successfully." 
                    : "Doctor professional verification status has been suspended."
            )
        );
});
// ⚡ FEATURE 4: Doctor Performance Analytics Engine
// WHY: Provides doctors with real-time summary statistics regarding earnings and patient reach on their dashboard.
const getDoctorAnalytics = asyncHandler(async (req, res) => {
    // 1. 🛡️ Security Check
    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Dashboard metrics are restricted to healthcare providers.");
    }

    const doctorId = req.user?._id;

    // 2. 📊 Execute Aggregation Pipeline
    const analytics = await Appointment.aggregate([
        {
            // STAGE 1: Target only completed appointments for THIS specific doctor
            $match: {
                doctor: new mongoose.Types.ObjectId(doctorId),
                status: "completed"
            }
        },
        {
            // STAGE 2: Group data to count total appointments and collect unique patient IDs
            $group: {
                _id: "$doctor",
                totalCompletedAppointments: { $sum: 1 },
                // $addToSet automatically filters out duplicates to track unique patients
                uniquePatientsList: { $addToSet: "$patient" }
            }
        },
        {
            // STAGE 3: Join with doctorprofiles to extract current consultation fee structure
            $lookup: {
                from: "doctorprofiles", // Collection name in MongoDB Atlas
                localField: "_id",
                foreignField: "doctor",
                as: "profileDetails"
            }
        },
        {
            // STAGE 4: Flatten the profile details array
            $unwind: "$profileDetails"
        },
        {
            // STAGE 5: Project the final mathematical calculations cleanly
            $project: {
                _id: 0, // Hide the raw doctor ID reference
                totalConsultations: "$totalCompletedAppointments",
                uniquePatientsCount: { $size: "$uniquePatientsList" },
                // Compute total earnings: (Total Completed Appointments) * (Doctor Fee)
                totalEarnings: {
                    $multiply: [
                        "$totalCompletedAppointments",
                        "$profileDetails.fees"
                    ]
                }
            }
        }
    ]);

    // 3. Fallback Structure if a fresh doctor has 0 completed consultations yet
    const summaryData = analytics[0] || {
        totalConsultations: 0,
        uniquePatientsCount: 0,
        totalEarnings: 0
    };

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                summaryData, 
                "Doctor diagnostic dashboard analytics compiled successfully."
            )
        );
});
export {
    createOrUpdateDoctorProfile,
    getMyDoctorProfile,
    verifyDoctorProfile,
    getDoctorAnalytics 
};