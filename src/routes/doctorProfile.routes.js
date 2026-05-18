// 📑 src/routes/doctorProfile.routes.js
import { Router } from "express";
import { 
    getMyDoctorProfile, 
    verifyDoctorProfile, 
    getDoctorAnalytics // 👈 Import the analytics controller
} from "../controllers/doctorProfile.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

// Client Dashboard Profiles
router.route("/profile").get(getMyDoctorProfile);
router.route("/analytics").get(getDoctorAnalytics); // 👈 📊 Add this secure route

// Administrative Gateways
router.route("/verify/:doctorId").patch(verifyDoctorProfile);

export default router;