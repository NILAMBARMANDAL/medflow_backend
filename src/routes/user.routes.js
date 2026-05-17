import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
const router = Router();
router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "medicalReports", maxCount: 5 },


    ]),
    registerUser);
router.route("/login").post(login);
//secured routes (need access token)
router.route("/logout").post(verifyJWT, logoutUser);
export default router;