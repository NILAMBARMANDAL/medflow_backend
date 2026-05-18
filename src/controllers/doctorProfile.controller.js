import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { DoctorProfile } from "../models/doctorProfile.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";
import { Appointment } from "../models/appointment.model.js";
const createOrUpdateDoctorProfile = asyncHandler(async (req, res) => {
    const { specialization, experience, fees, qualifications, bio, availability } = req.body;

   
    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Only doctor accounts can manage a professional profile");
    }

    const certificateLocalPath = req.file?.path;

    const existingProfile = await DoctorProfile.findOne({ doctor: req.user?._id });
    if (!existingProfile && !certificateLocalPath) {
        throw new ApiError(400, "Official medical registration certificate document is required for onboarding");
    }

    let certificateUrl = existingProfile?.medicalCertificate;
    if (certificateLocalPath) {
        const uploadedFile = await uploadOnCloudinary(certificateLocalPath);
        if (!uploadedFile.url) {
            throw new ApiError(400, "Failed to upload medical certificate to Cloudinary");
        }
        certificateUrl = uploadedFile.url;
    }

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
                
            }
        },
        { upsert: true, returnDocument: 'after', runValidators: true }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, profile, "Doctor credentials updated successfully and queued for verification reviews"));
});

const getMyDoctorProfile = asyncHandler(async (req, res) => {
   
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

const verifyDoctorProfile = asyncHandler(async (req, res) => {
    const { doctorId } = req.params; 
    const { status } = req.body;     

    if (req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Only system administrators can authorize doctor accounts.");
    }

    if (status === undefined) {
        throw new ApiError(400, "Verification status flag is required in the request body.");
    }
    const profile = await DoctorProfile.findOneAndUpdate(
        { doctor: doctorId },
        { $set: { isVerified: status } },
        { 
            new: true,          
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

const getDoctorAnalytics = asyncHandler(async (req, res) => {
   
    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Dashboard metrics are restricted to healthcare providers.");
    }

    const doctorId = req.user?._id;

    const analytics = await Appointment.aggregate([
        {
            
            $match: {
                doctor: new mongoose.Types.ObjectId(doctorId),
                status: "completed"
            }
        },
        {
           
            $group: {
                _id: "$doctor",
                totalCompletedAppointments: { $sum: 1 },
          
                uniquePatientsList: { $addToSet: "$patient" }
            }
        },
        {
         
            $lookup: {
                from: "doctorprofiles", 
                localField: "_id",
                foreignField: "doctor",
                as: "profileDetails"
            }
        },
        {
            
            $unwind: "$profileDetails"
        },
        {
           
            $project: {
                _id: 0, 
                totalConsultations: "$totalCompletedAppointments",
                uniquePatientsCount: { $size: "$uniquePatientsList" },
             
                totalEarnings: {
                    $multiply: [
                        "$totalCompletedAppointments",
                        "$profileDetails.fees"
                    ]
                }
            }
        }
    ]);

   
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