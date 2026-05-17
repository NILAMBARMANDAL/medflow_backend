import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

// Initialize dotenv at the entry point
dotenv.config({
    path: './.env'
});

connectDB()
.then(() => {
    // Check for internal Express system socket assignment faults
    app.on("error", (error) => {
        console.log("Express Server Error: ", error);
        throw error;
    });

    app.listen(process.env.PORT || 8000, () => {
        console.log(` Server is running on port ${process.env.PORT || 8000}`);
    });
})
.catch((err) => {
    // ☘️ Always log your database connection faults!
    console.log("MongoDB connection failed !!! ", err);
});