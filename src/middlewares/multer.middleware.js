import multer from "multer";

const storage = multer.diskStorage({
    // 1. Define where the incoming file should be physically written on your machine
    destination: function (req, file, cb) {
        cb(null, "./public/temp"); 
    },
    
    // 2. Define the filename configuration
    filename: function (req, file, cb) {
        // Retaining the original file name uploaded by the user
        cb(null, file.originalname);
    }
});

// 3. Initialize multer with the disk storage engine setup
export const upload = multer({ 
    storage, 
});