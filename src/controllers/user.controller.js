import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { DoctorProfile } from "../models/doctorProfile.model.js"; 
import jwt from "jsonwebtoken";

const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating credentials.");
    }
};

const registerUser = asyncHandler(async (req, res) => {
    
    const { 
        fullName, email, username, password, phoneNumber, role,
        specialization, experience, fees, qualifications, bio, availability 
    } = req.body;

    if (
        [fullName, email, username, password, phoneNumber, role].some(
            (field) => field?.trim() === "" || field === undefined
        )
    ) {
        throw new ApiError(400, "All base account registration fields are required.");
    }

    const validRoles = ["patient", "doctor", "admin"]; 
    const userRole = role.toLowerCase();
    if (!validRoles.includes(userRole)) {
        throw new ApiError(400, "Invalid system role specified.");
    }
    if (userRole === "doctor") {
        if (!specialization || experience === undefined || fees === undefined || !qualifications) {
            throw new ApiError(400, "Medical profile fields (specialization, experience, fees, qualifications) are required for doctor accounts.");
        }
    }

    const existedUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existedUser) {
        throw new ApiError(409, "User with this email or username already exists.");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Profile avatar image file is required.");
    }

    const certificateLocalPath = req.files?.certificate?.[0]?.path; 
    if (userRole === "doctor" && !certificateLocalPath) {
        throw new ApiError(400, "Official medical registration certificate document is mandatory for doctor accounts.");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
        throw new ApiError(500, "Failed to upload avatar to cloud storage.");
    }

    let certificateUrl = "";
    if (userRole === "doctor" && certificateLocalPath) {
        const certificateFile = await uploadOnCloudinary(certificateLocalPath);
        if (!certificateFile) {
            throw new ApiError(500, "Failed to upload medical certificate to cloud storage.");
        }
        certificateUrl = certificateFile.url;
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password,
        phoneNumber,
        role: userRole
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the account.");
    }

    if (userRole === "doctor") {
        try {
            await DoctorProfile.create({
                doctor: createdUser._id, 
                specialization,
                experience: Number(experience),
                fees: Number(fees),
              
                qualifications: typeof qualifications === "string" ? JSON.parse(qualifications) : qualifications,
                availability: typeof availability === "string" ? JSON.parse(availability) : (availability || []),
                bio: bio || "",
                medicalCertificate: certificateUrl,
                isVerified: false 
            });
        } catch (error) {
         
            await User.findByIdAndDelete(createdUser._id);
            throw new ApiError(500, `Doctor profile mapping failed: ${error.message}. Account creation cancelled cleanly.`);
        }
    }

    return res.status(201).json(
        new ApiResponse(
            201, 
            createdUser, 
            userRole === "doctor" 
                ? "Doctor registered successfully! Credentials queued for validation reviews." 
                : "User registered successfully into MedFlow!"
        )
    );
});

const loginUser = asyncHandler(async (req, res) => {
   const { email, username, password } = req.body;
   if (!(email || username)) {
    throw new ApiError(400, "Please provide either email or username to login");
   }
   
   const user = await User.findOne({ $or: [{ username }, { email }] });
   if (!user) {
    throw new ApiError(404, "No user found with the provided email or username");
   }
   
   const isPasswordCorrect = await user.isPasswordCorrect(password);
   if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid credentials");
   }
   
   const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);
   const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
   
   const options = {
        httpOnly: true,
        secure: true
   };
   
   return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully")
    );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $unset: { refreshToken: 1 } },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        };
    
        
        const { accessToken, refreshToken: newRefreshToken } = await generateAccessTokenAndRefreshToken(user._id);
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed")
        );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, phoneNumber } = req.body;

    if (!fullName && !phoneNumber) {
        throw new ApiError(400, "Provide at least one profile property (fullName or phoneNumber) to update.");
    }

    let updateFields = {};
    if (fullName) updateFields.fullName = fullName;
    if (phoneNumber) updateFields.phoneNumber = phoneNumber;

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: updateFields },
        { new: true, runValidators: true }
    ).select("-password"); 

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "Profile context metadata updated successfully."));
});



const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Both old password and new password are required");
    }

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading avatar to Cloudinary");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id, 
        { $set: { avatar: avatar.url } },
        { new: true }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});


const searchAvailableDoctors = asyncHandler(async (req, res) => {
    
    const { specialization, maxFees, minExperience, page = 1, limit = 10 } = req.query;

    
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const skipValue = (pageNumber - 1) * limitNumber;

    let queryConditions = { isVerified: true };

    if (specialization) {
        queryConditions.specialization = { $regex: specialization, $options: "i" };
    }
    if (maxFees) {
        queryConditions.fees = { $lte: Number(maxFees) };
    }
    if (minExperience) {
        queryConditions.experience = { $gte: Number(minExperience) };
    }

    const doctors = await DoctorProfile.find(queryConditions)
        .populate("doctor", "fullName email avatar phoneNumber")
        .select("-medicalCertificate")
        .skip(skipValue)
        .limit(limitNumber);
    const totalMatches = await DoctorProfile.countDocuments(queryConditions);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                {
                    doctors,
                    currentPage: pageNumber,
                    totalPages: Math.ceil(totalMatches / limitNumber),
                    totalResults: totalMatches
                }, 
                "Paginated provider directory parsed successfully."
            )
        );
});
// 📑 Add these inside src/controllers/user.controller.js

// 🔍 1. Fetch all doctors awaiting verification
const getPendingDoctors = asyncHandler(async (req, res) => {
    // Check if the accessing user is an admin
    if (req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Admin authorization required.");
    }

    // Find all profiles where isVerified is false, and join their core User account data
    // (Ensure you have imported your DoctorProfile model at the top of this file!)
    const pendingDoctors = await DoctorProfile.find({ isVerified: false })
        .populate("doctor", "fullName username email phoneNumber avatar sex");

    return res.status(200).json(
        new ApiResponse(200, pendingDoctors, "Pending doctor verifications retrieved successfully.")
    );
});

// ⚡ 2. Approve or Reject Doctor Verification State
const verifyDoctorProfile = asyncHandler(async (req, res) => {
    const { profileId, action } = req.body; // action can be "approve" or "reject"

    if (req.user?.role !== "admin") {
        throw new ApiError(403, "Access denied. Admin authorization required.");
    }

    const profile = await DoctorProfile.findById(profileId);
    if (!profile) {
        throw new ApiError(404, "Doctor profile record not found.");
    }

    if (action === "approve") {
        profile.isVerified = true;
        await profile.save();
        
        // Ensure their base account role is active as a doctor
        await User.findByIdAndUpdate(profile.doctor, { role: "doctor" });

        return res.status(200).json(
            new ApiResponse(200, profile, "Doctor has been successfully verified and activated! ✅")
        );
    } else if (action === "reject") {
        const doctorUserId = profile.doctor;
        await DoctorProfile.findByIdAndDelete(profileId);
        await User.findByIdAndUpdate(doctorUserId, { role: "patient" }); // Fallback back to normal user

        return res.status(200).json(
            new ApiResponse(200, null, "Doctor profile onboarding request rejected and cleared. ❌")
        );
    }

    throw new ApiError(400, "Invalid verification action type specified.");
});
export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,      
    updateAccountDetails, 
    changeCurrentPassword,
    updateUserAvatar,
    searchAvailableDoctors,
    getPendingDoctors,
    verifyDoctorProfile
};