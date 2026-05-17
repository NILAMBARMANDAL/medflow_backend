import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
const registerUser = asyncHandler(async (req, res) => {
    // Step 1: Extract registration details from request body
    const { fullName, email, username, password, phoneNumber, role } = req.body;
    console.log("email", email);

    // Step 2: Validation - Ensure no critical fields are empty or just whitespace
    if (
        [fullName, email, username, password, phoneNumber, role].some(
            (field) => field?.trim() === "" || field === undefined
        )
    ) {
        throw new ApiError(400, "All registration fields are required.");
    }

    // Step 3: Validate Role Type (Defensive guard against random role strings)
    const validRoles = ["patient", "doctor", "admin"];
    if (!validRoles.includes(role.toLowerCase())) {
        throw new ApiError(400, "Invalid system role specified.");
    }

    // Step 4: Check if user already exists in DB via unique fields (Email or Username)
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User with this email or username already exists.");
    }

    // Step 5: Capture the local file paths from req.files
    // We use optional chaining (?.[0]) because the fields are arrays
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    
    if (!avatarLocalPath) {
        throw new ApiError(400, "Profile avatar image file is required.");
    }

    // Capture medical report local paths if they exist (optional during registration)
    const medicalReportsLocalFiles = req.files?.medicalReports || [];

    // Step 6: Upload files to Cloudinary
    // Upload the avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
        throw new ApiError(500, "Failed to upload avatar to cloud storage.");
    }

    // Upload medical reports if the user provided them
    let uploadedReportsUrls = [];
    if (medicalReportsLocalFiles.length > 0) {
        // Loop through each local file path intercepted by Multer
        for (const file of medicalReportsLocalFiles) {
            const uploadedFile = await uploadOnCloudinary(file.path);
            if (uploadedFile) {
                uploadedReportsUrls.push(uploadedFile.url); // Collect the permanent cloud URLs
            }
        }
    }

    // Step 7: Create user in database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password,
        phoneNumber,
        role: role.toLowerCase(),
        // If you want to temporarily log these initial files in the user document:
        initialReports: uploadedReportsUrls 
    });

// ... (Rest of the controller remains identical)
    // Step 8: Fetch the newly created record without its security keys for the response payload
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the account.");
    }

    // Step 9: Return a clean, standardized structural API response to the client
    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully into MedFlow!")
    );
});

const generateAccessTokenAndRefreshToken = async (userId) => {
    try{
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    await user.save({ validateBeforeSave: false });
  
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
    }catch(error){
        console.error("🚨 DETAILED TOKEN FAULT:", error);
        throw new ApiError(500, "something went wrong while generating refresh and acccess token");
    }
};
const loginUser = asyncHandler(async (req, res) => {
   const { email,username, password } = req.body;
   if(!(email || username)){
    throw new ApiError(400, "Please provide either email or username to login");
   }
   const user = await User.findOne({
    $or: [{username}, {email}]
   });
   if(!user){
    throw new ApiError(404, "No user found with the provided email or username");
   }
   const isPasswordCorrect = await user.isPasswordCorrect(password);
    if(!isPasswordCorrect){
        throw new ApiError(401, "Invalid credentials");
    }
    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, 
            { user: loggedInUser, accessToken, refreshToken 

            }, "User logged in successfully")
    );
});
const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})
// ⚡ FEATURE 1: Get Current User Profile Data
// WHY: When a user refreshes their dashboard, the frontend needs to pull their latest profile info immediately.
const getCurrentUser = asyncHandler(async (req, res) => {
    // WHY req.user works: Our verifyJWT middleware already ran, found the user from the token, and attached it to the request object!
    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                req.user, // Sends back the user info that verifyJWT fetched
                "Current user fetched successfully"
            )
        );
});

// ⚡ FEATURE 2: Update Profile Text Details
// WHY: Users need to update their full name or contact details without affecting passwords or re-uploading files.
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, phoneNumber } = req.body;

    // Validation check
    if (!fullName || !phoneNumber) {
        throw new ApiError(400, "All fields (fullName and phoneNumber) are required");
    }

    // WHY findByIdAndUpdate with $set: We use $set to change ONLY these specific fields. 
    // This safely bypasses our password hashing hook so we don't accidentally encrypt an already encrypted password!
    const user = await User.findByIdAndUpdate(
        req.user?._id, // Got the ID from the verifyJWT bouncer
        {
            $set: {
                fullName: fullName,
                phoneNumber: phoneNumber
            }
        },
        { 
            new: true // This option forces MongoDB to return the NEW updated user document rather than the old one
        }
    ).select("-password -refreshToken"); // Securely strip out credentials before sending data back

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                user, 
                "Account details updated successfully"
            )
        );
});
// ⚡ FEATURE 3: Change Current Password
// WHY: Users must be able to update their password securely by verifying their old password first.
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    // 1. Validation check
    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Both old password and new password are required");
    }

    // 2. Fetch the user using the ID attached by the verifyJWT bouncer middleware
    const user = await User.findById(req.user?._id);

    // 3. Verify if the typed old password matches the database hash using our instance method
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password");
    }

    // 4. Assign the new unhashed password to the user object
    user.password = newPassword;

    // 5. Save the document back to MongoDB
    // WHY validateBeforeSave: false? We only updated the password field. This option tells Mongoose 
    // to skip validation checks on other fields (like avatar or phone) since we aren't re-uploading them here.
    // This cleanly triggers our pre("save") hook to automatically hash the new password!
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                {}, 
                "Password changed successfully"
            )
        );
});
// ⚡ FEATURE 4: Update User Avatar Image
// WHY: Users need to be able to change their profile picture seamlessly.
const updateUserAvatar = asyncHandler(async (req, res) => {
    // 1. Multer mounts single file uploads directly to req.file (NOT req.files)
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    // 2. Upload the new local file stream up to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading avatar to Cloudinary");
    }

    // 3. Update the avatar string inside MongoDB
    const user = await User.findByIdAndUpdate(
        req.user?._id, // Securely pulled from our verifyJWT bouncer
        {
            $set: {
                avatar: avatar.url // Swapping the database URL link with the new one
            }
        },
        { 
            new: true // Returns the fresh updated document back to us
        }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                user, 
                "Avatar image updated successfully"
            )
        );
});
export { registerUser,
      loginUser,
      logoutUser,
      refreshAccessToken
      ,getCurrentUser,      

    updateAccountDetails, 
    changeCurrentPassword,
    updateUserAvatar
};