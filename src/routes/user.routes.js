import { Router } from "express";
import { loginUser, registerUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../controllers/auth.middleware.js";
import { logoutUser,refreshAccessToken } from "../controllers/user.controller.js";
const router = Router();
router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "medicalReports", maxCount: 5 },


    ]),
    registerUser);
router.route("/login").post(loginUser);
//secured routes (need access token)
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
export default router;