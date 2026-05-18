import { Router } from "express";
import { addDoctorReview, getDoctorReviews } from "../controllers/review.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();


router.route("/doctor/:doctorId").get(getDoctorReviews);


router.route("/add").post(verifyJWT, addDoctorReview);

export default router;