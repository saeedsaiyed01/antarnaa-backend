import express from "express";
import { verifyToken } from "../middleware/auth";
import Booking from "../models/Booking";
import Doctor from "../models/Doctor";
import Prescription from "../models/Prescription";
import client from "prom-client";

const router = express.Router();

// Prometheus metrics
const doctorOperations = new client.Counter({
  name: "antarnaa_doctor_operations_total",
  help: "Total number of doctor operations",
  labelNames: ["operation", "status"],
});

const doctorDuration = new client.Histogram({
  name: "antarnaa_doctor_duration_seconds",
  help: "Duration of doctor operations",
  labelNames: ["operation"],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const prescriptionOperations = new client.Counter({
  name: "antarnaa_prescription_operations_total",
  help: "Total number of prescription operations",
  labelNames: ["operation", "status"],
});

const availabilityUpdates = new client.Counter({
  name: "antarnaa_availability_updates_total",
  help: "Total number of availability updates",
  labelNames: ["status"],
});

// Get doctor profile
router.get("/me", verifyToken(["doctor"]), async (req, res) => {
  const timer = doctorDuration.startTimer({ operation: "get_profile" });
  try {
    // @ts-ignore
    const doctor = await Doctor.findById(req.user.id).select("-password");
    if (!doctor) {
      doctorOperations.labels("get_profile", "not_found").inc();
      timer();
       res.status(404).json({ error: "Doctor not found" });
       return;
    }
    doctorOperations.labels("get_profile", "success").inc();
    timer();
    res.json(doctor);
  } catch (err) {
    doctorOperations.labels("get_profile", "failure").inc();
    timer();
    res.status(500).json({ error: "Failed to fetch doctor profile" });
  }
});

// Get assigned bookings
router.get("/bookings", verifyToken(["doctor"]), async (req, res) => {
  const timer = doctorDuration.startTimer({ operation: "get_bookings" });
  try {
    // @ts-ignore
    const bookings = await Booking.find({ doctorId: req.user.id })
      .populate("userId")
      .populate("doctorId");
    doctorOperations.labels("get_bookings", "success").inc();
    timer();
    res.json(bookings);
  } catch (err) {
    doctorOperations.labels("get_bookings", "failure").inc();
    timer();
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Update availability
router.post("/availability", verifyToken(["doctor"]), async (req, res) => {
  const timer = doctorDuration.startTimer({ operation: "update_availability" });
  try {
    const { availability } = req.body;
    if (!availability) {
      doctorOperations.labels("update_availability", "invalid_input").inc();
      availabilityUpdates.labels("invalid_input").inc();
      timer();
       res.status(400).json({ error: "Availability is required" });
       return;
    }

    // @ts-ignore
    await Doctor.findByIdAndUpdate(req.user.id, { availability });
    doctorOperations.labels("update_availability", "success").inc();
    availabilityUpdates.labels("success").inc();
    timer();
    res.sendStatus(200);
  } catch (err) {
    doctorOperations.labels("update_availability", "failure").inc();
    availabilityUpdates.labels("failure").inc();
    timer();
    res.status(500).json({ error: "Failed to update availability" });
  }
});

router.get("/availability", verifyToken(["doctor"]), async (req, res) => {
  const timer = doctorDuration.startTimer({ operation: "get_availability" });
  try {
    // @ts-ignore
    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) {
      doctorOperations.labels("get_availability", "not_found").inc();
      timer();
      res.json({ availability: {} });
    }
    // @ts-ignore
    doctorOperations.labels("get_availability", "success").inc();
    timer();
    res.json({ availability: doctor?.availability || {} });
  } catch (err) {
    doctorOperations.labels("get_availability", "failure").inc();
    timer();
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

router.post("/prescription", verifyToken(["doctor"]), async (req, res) => {
  const timer = doctorDuration.startTimer({ operation: "save_prescription" });
  try {
    const { bookingId, ...prescription } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      prescriptionOperations.labels("save", "booking_not_found").inc();
      timer();
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    const payload = {
      bookingId,
      doctorId: booking.doctorId,
      patientId: booking.userId,
      ...prescription,
    };

    const saved = await Prescription.findOneAndUpdate({ bookingId }, payload, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    prescriptionOperations.labels("save", "success").inc();
    timer();
    res.json({ message: "Prescription saved/updated", prescription: saved });
  } catch (err) {
    prescriptionOperations.labels("save", "failure").inc();
    timer();
    res.status(500).json({ error: "Failed to save prescription" });
  }
});

// Get prescription for a booking
router.get(
  "/prescription/:bookingId",
  verifyToken(["doctor"]),
  async (req, res) => {
    const timer = doctorDuration.startTimer({ operation: "get_prescription" });
    try {
      const prescription = await Prescription.findOne({
        bookingId: req.params.bookingId,
      });
      if (!prescription) {
        prescriptionOperations.labels("get", "not_found").inc();
        timer();
        res.status(404).json({ error: "no prescription found" });
        return;
      }
      prescriptionOperations.labels("get", "success").inc();
      timer();
      res.json(prescription);
      
    } catch (err) {
      prescriptionOperations.labels("get", "failure").inc();
      timer();
      res.status(500).json({ error: "Failed to fetch prescription" });
    }
  }
);

export default router;
