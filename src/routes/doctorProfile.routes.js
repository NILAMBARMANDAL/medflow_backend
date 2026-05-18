
import { Router } from "express";
import { 
    getMyDoctorProfile, 
    verifyDoctorProfile, 
    getDoctorAnalytics 
} from "../controllers/doctorProfile.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);


router.route("/profile").get(getMyDoctorProfile);
router.route("/analytics").get(getDoctorAnalytics); // 👈 📊 Add this secure route


router.route("/verify/:doctorId").patch(verifyDoctorProfile);

export default router;