// src/app.ts
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import path from "path";
import errorHandler from "./middleware/errors";
import adminRoutes from "./routes/adminRoutes";
import authRoutes from "./routes/authRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import doctorRoutes from "./routes/doctorRoutes";
import prescriptionRoutes from "./routes/prescriptionRoutes";
import userRoutes from "./routes/userRoutes";
dotenv.config();

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["*"],
    allowedHeaders: ["*"],
  })
);
app.use(morgan("dev"));
app.use(express.json());

// Serve static files from the 'uploads' directory
app.use("/api/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/prescriptions", prescriptionRoutes);

// Error handler middleware (must be last)
app.use(errorHandler);

export default app; // ✅ Export default app
