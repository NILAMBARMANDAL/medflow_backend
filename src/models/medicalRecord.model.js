import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
const medicalRecordSchema = new Schema(
    {
        patient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true // Essential for pulling up a patient's medical history instantly
        },
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        documentUrl: {
            type: String, // Secure binary download/view URL provided by Cloudinary
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        recordType: {
            type: String,
            enum: ["Prescription", "Lab Report", "Scan/X-Ray", "Discharge Summary", "Other"],
            default: "Lab Report",
            required: true
        },
        // 🧠 The Data Science Layer:
        // When your FastAPI Python OCR engine finishes scanning an image, 
        // it updates this object with structured parameters (e.g., { hemoglobin: "14.2", bp: "120/80" })
        extractedData: {
            type: Object,
            default: {}
        },
        notes: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true
    }
);
// 2. Load the plugin into the schema BEFORE creating the model
medicalRecordSchema.plugin(mongooseAggregatePaginate);
export const MedicalRecord = mongoose.model("MedicalRecord", medicalRecordSchema);