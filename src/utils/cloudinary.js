import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";
import dotenv from "dotenv"; // ☘️ Explicitly import dotenv inside this utility

// Force-load variables directly here to guarantee initialization sequence matches
dotenv.config({
    path: './.env'
});

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        
        // Upload the file stream directly to Cloudinary core servers
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });
        
        // Wipe the local temp file once cloud delivery confirmation arrives
        fs.unlinkSync(localFilePath);
        return response;

    } catch (error) {
        // Expose explicit storage service rejections in your terminal
        console.error("🚨 CLOUDINARY UPLOAD FAULT:", error);
        
        // Defensive check: Only attempt unlinking if the file exists locally
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return null;
    }
};

export { uploadOnCloudinary };