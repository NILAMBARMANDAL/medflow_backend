import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
export { registerUser,  loginUser,logoutUser };