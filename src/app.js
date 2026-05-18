import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import appointmentRouter from "./routes/appointment.routes.js";
import doctorProfileRouter from "./routes/doctorProfile.routes.js";
import medicalRecordRouter from "./routes/medicalRecord.routes.js";
import reviewRouter from "./routes/review.routes.js";
const app = express();
app.use(cors({
    origin:process.env.CORS_ORIGIN,
    Credentials:true 
}));
app.use(express.json({limit:"16kb"}));
app.use(express.urlencoded({extended:true,limit:"16kb"}));
app.use(express.static("public"));
app.use(cookieParser());
//routes import
import userRouter from "./routes/user.routes.js";
app.use("/api/v1/users",userRouter);
app.use("/api/v1/appointments",appointmentRouter);
app.use("/api/v1/doctor-profiles", doctorProfileRouter);
app.use("/api/v1/medical-records", medicalRecordRouter);
app.use("/api/v1/reviews", reviewRouter);
export {app};