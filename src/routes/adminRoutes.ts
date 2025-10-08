// src/routes/adminRoutes.ts
import express from "express";
import { verifyToken } from "../middleware/auth";
import Booking from "../models/Booking";
import Doctor from "../models/Doctor";
import User from "../models/User";
import ReferralCode from "../models/ReferralCode"; // Import ReferralCode model
import { getOrCreateRoomForDoctor, generateJoinLinks } from "../utils/hms";
import { sendWhatsapp } from "../utils/twilio";
import bcrypt from "bcryptjs";
import client from "prom-client";
import multer from "multer";

import type { Request } from "express";

// Extend Express Request type to include 'file' (for multer)
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

const router = express.Router();

// Prometheus metrics
const adminOperations = new client.Counter({
  name: "antarnaa_admin_operations_total",
  help: "Total number of admin operations",
  labelNames: ["operation", "status"],
});

const adminDuration = new client.Histogram({
  name: "antarnaa_admin_duration_seconds",
  help: "Duration of admin operations",
  labelNames: ["operation"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const doctorAssignments = new client.Counter({
  name: "antarnaa_doctor_assignments_total",
  help: "Total number of doctor assignments",
  labelNames: ["status"],
});

const whatsappNotifications = new client.Counter({
  name: "antarnaa_whatsapp_notifications_total",
  help: "Total number of WhatsApp notifications sent",
  labelNames: ["type", "status"],
});

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save files to the 'uploads/' directory
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// Get all bookings (with populated user and doctor)
router.get("/bookings", verifyToken(["admin"]), async (req, res) => {
  const timer = adminDuration.startTimer({ operation: "get_bookings" });
  try {
    const bookings = await Booking.find()
      .populate("userId")
      .populate("doctorId")
      .sort({ date: -1 });
    adminOperations.labels("get_bookings", "success").inc();
    timer();
    res.json(bookings);
  } catch (err) {
    adminOperations.labels("get_bookings", "failure").inc();
    timer();
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Assign or change doctor
router.post("/assign-doctor", verifyToken(["admin"]), async (req, res) => {
  const timer = adminDuration.startTimer({ operation: "assign_doctor" });
  const { bookingId, doctorId } = req.body;

  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.name) {
      adminOperations.labels("assign_doctor", "failure").inc();
      doctorAssignments.labels("doctor_not_found").inc();
      timer();
      res.status(400).json({ message: "Doctor not found" });
      return; // Explicitly return void
    }

    const booking = await Booking.findById(bookingId).populate("userId");
    if (!booking) {
      adminOperations.labels("assign_doctor", "failure").inc();
      doctorAssignments.labels("booking_not_found").inc();
      timer();
      res.status(404).json({ message: "Booking not found" });
      return; // Explicitly return void
    }

    const user = await User.findById(booking.userId);
    if (!user) {
      adminOperations.labels("assign_doctor", "failure").inc();
      doctorAssignments.labels("user_not_found").inc();
      timer();
      res.status(400).json({ message: "User not found" });
      return; // Explicitly return void
    }

    if (!doctor.roomId) {
      doctor.roomId = await getOrCreateRoomForDoctor(doctor);
    }
    const videoLink = await generateJoinLinks(
      doctor.roomId!,
      user.username!,
      doctor.name
    );

    booking.doctorId = doctorId;
    booking.videoLink = videoLink;
    booking.status = "confirmed";
    await booking.save();

    if (user.number && doctor.number) {
      try {
        await sendWhatsapp(
          user.number,
          `🩺 Dr. ${doctor.name} has been assigned for your consultation at ${booking.time} on ${booking.date}. Join: ${videoLink.user}`,
          user.countryCode
        );
        whatsappNotifications.labels("user_assignment", "success").inc();

        await sendWhatsapp(
          doctor.number,
          `👩‍⚕️  Dr. ${doctor.name} you have a new booking assigned for ${user.username} at ${booking.time} on ${booking.date}. Join: ${videoLink.doctor}`
        );
        whatsappNotifications.labels("doctor_assignment", "success").inc();
      } catch (whatsappErr) {
        whatsappNotifications.labels("assignment", "failure").inc();
        console.log("WhatsApp notification failed:", whatsappErr);
      }
    }

    adminOperations.labels("assign_doctor", "success").inc();
    doctorAssignments.labels("success").inc();
    timer();
    res.status(200).json({ msg: "assigned doctor" });
  } catch (err) {
    console.log(err);
    adminOperations.labels("assign_doctor", "failure").inc();
    doctorAssignments.labels("error").inc();
    timer();
    res.status(500).json({ error: "Doctor assignment failed" });
  }
});

// Create doctor
router.post(
  "/create-doctor",
  verifyToken(["admin"]),
  upload.single("image"), // Handle single image upload
  async (req, res) => {
    const timer = adminDuration.startTimer({ operation: "create_doctor" });
    const {
      name,
      number,
      experience,
      password,
      email,
      registrationNumber,
      degree,
    } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Generate a unique 6-digit prescriptionId
      const prescriptionId = Math.floor(100000 + Math.random() * 900000).toString();

      const doctor = new Doctor({
        name,
        number,
        experience,
        password: hashedPassword,
        email,
        registrationNumber,
        degree,
        prescriptionId,
        role: "doctor",
      });

      // Handle image upload if provided
      if (req.file) {
        doctor.image = req.file.path; // Save the file path to the database
      }

      await getOrCreateRoomForDoctor(doctor);
      await doctor.save();

      adminOperations.labels("create_doctor", "success").inc();
      timer();
      res.json({ doctor });
      return; // Explicitly return void
    } catch (err) {
      adminOperations.labels("create_doctor", "failure").inc();
      timer();
      res.status(500).json({ error: "Failed to create doctor" });
      return; // Explicitly return void
    }
  }
);

// Get all doctors
router.get("/doctors", verifyToken(["admin"]), async (req, res) => {
  const timer = adminDuration.startTimer({ operation: "get_doctors" });
  try {
    const doctors = await Doctor.find().select("-password");
    adminOperations.labels("get_doctors", "success").inc();
    timer();
    res.json(doctors);
  } catch (err) {
    adminOperations.labels("get_doctors", "failure").inc();
    timer();
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

// Delete doctor
router.delete("/delete-doctor/:id", verifyToken(["admin"]), async (req, res): Promise<void> => {
  const timer = adminDuration.startTimer({ operation: "delete_doctor" });
  const { id } = req.params;

  try {
    const doctor = await Doctor.findByIdAndDelete(id);
    if (!doctor) {
      adminOperations.labels("delete_doctor", "failure").inc();
      timer();
      res.status(404).json({ message: "Doctor not found" });
      return;
    }

    adminOperations.labels("delete_doctor", "success").inc();
    timer();
    res.status(200).json({ message: "Doctor deleted successfully" });
  } catch (err) {
    console.error(err);
    adminOperations.labels("delete_doctor", "failure").inc();
    timer();
    res.status(500).json({ error: "Failed to delete doctor" });
  }
});

// Delete referral code
router.delete("/delete-referral/:id", verifyToken(["admin"]), async (req, res): Promise<void> => {
  const timer = adminDuration.startTimer({ operation: "delete_referral" });
  const { id } = req.params;

  try {
    const referral = await ReferralCode.findByIdAndDelete(id);
    if (!referral) {
      adminOperations.labels("delete_referral", "failure").inc();
      timer();
      res.status(404).json({ message: "Referral code not found" });
      return;
    }

    adminOperations.labels("delete_referral", "success").inc();
    timer();
    res.status(200).json({ message: "Referral code deleted successfully" });
  } catch (err) {
    console.error(err);
    adminOperations.labels("delete_referral", "failure").inc();
    timer();
    res.status(500).json({ error: "Failed to delete referral code" });
  }
});

export default router;
