import { Router } from "express";
import { uploadMedicalRecord, getMyMedicalRecords,getPatientMedicalRecordsForDoctor } from "../controllers/medicalRecord.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyJWT);

router.route("/upload").post(upload.array("attachments", 5), uploadMedicalRecord);
router.route("/timeline").get(getMyMedicalRecords);
router.route("/patient/:patientId").get(getPatientMedicalRecordsForDoctor);
export default router;