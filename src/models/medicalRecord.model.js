import mongoose, { Schema } from "mongoose";

const medicalRecordSchema = new Schema(
    {
        
        patient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true 
        },
     
        issuedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        title: {
            type: String,
            required: [true, "Record title (e.g., 'Annual Blood Count') is required"],
            trim: true
        },
        recordType: {
            type: String,
            required: true,
            enum: ["Prescription", "Lab Report", "Scan", "Immunization", "Other"],
            index: true 
        },
        description: {
            type: String,
            trim: true,
            maxLength: [500, "Description cannot exceed 500 characters"]
        },
       
        attachments: {
            type: [String], 
            validate: [
                (val) => val.length > 0, 
                "At least one document upload attachment is required to log a medical record"
            ]
        },
        recordDate: {
            type: Date,
            required: [true, "Please specify the date this medical event took place"],
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

export const MedicalRecord = mongoose.model("MedicalRecord", medicalRecordSchema);