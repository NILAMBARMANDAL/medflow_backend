import { Router } from "express";
import { 
    createOrUpdateDoctorProfile,
    getMyDoctorProfile, 
    getDoctorAnalytics 
} from "../controllers/doctorProfile.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyJWT);


router.route("/profile")
    .get(getMyDoctorProfile)
    .post(upload.single("certificate"), createOrUpdateDoctorProfile);

router.route("/analytics").get(getDoctorAnalytics);

export default router;