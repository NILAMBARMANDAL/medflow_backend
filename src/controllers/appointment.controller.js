import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Appointment } from "../models/appointment.model.js";


const bookAppointment = asyncHandler(async (req, res) => {
    const { doctorId, appointmentDate, reasonForVisit } = req.body;

  
    if (!doctorId || !appointmentDate || !reasonForVisit) {
        throw new ApiError(400, "All fields (doctorId, appointmentDate, reasonForVisit) are required");
    }

   
    const appointment = await Appointment.create({
        patient: req.user?._id,
        doctor: doctorId,
        appointmentDate,
        reasonForVisit,
        status: "pending"
    });

    if (!appointment) {
        throw new ApiError(500, "Something went wrong while booking the appointment");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, appointment, "Appointment booked successfully"));
});


const getUserAppointments = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const userRole = req.user?.role; // "patient" or "doctor" or "admin"


    const query = userRole === "doctor" ? { doctor: userId } : { patient: userId };

    const appointments = await Appointment.find(query).sort({ appointmentDate: 1 });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                appointments, 
                "User appointments retrieved successfully"
            )
        );
});

export {
    bookAppointment,
    getUserAppointments
};