import { Router } from "express";
import { 
    loginUser, 
    registerUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    updateAccountDetails,
    changeCurrentPassword,
    updateUserAvatar,
    searchAvailableDoctors 
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "certificate", maxCount: 1 }
    ]),
    registerUser
);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);

router.route("/doctors").get(searchAvailableDoctors);

router.route("/logout").post(verifyJWT, logoutUser);
router.route("/current-user").get(verifyJWT, getCurrentUser); 
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar);

export default router; 