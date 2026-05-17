import { Router } from "express";
import { bookAppointment, getUserAppointments } from "../controllers/appointment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();


router.use(verifyJWT);

router.route("/book").post(bookAppointment);
router.route("/my-appointments").get(getUserAppointments);

export default router;