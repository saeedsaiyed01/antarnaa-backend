// src/routes/bookingRoutes.ts
import express from "express";
import Booking from "../models/Booking";
import { verifyToken } from "../middleware/auth";
import { createPayment, verifySignature } from "../utils/razorpay";
import client from "prom-client";

const router = express.Router();

// Prometheus metrics
const bookingOperations = new client.Counter({
  name: "antarnaa_booking_operations_total",
  help: "Total number of booking operations",
  labelNames: ["operation", "status"],
});

const bookingDuration = new client.Histogram({
  name: "antarnaa_booking_duration_seconds",
  help: "Duration of booking operations",
  labelNames: ["operation"],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const paymentOperations = new client.Counter({
  name: "antarnaa_payment_operations_total",
  help: "Total number of payment operations",
  labelNames: ["operation", "status"],
});

const bookingsByStatus = new client.Gauge({
  name: "antarnaa_bookings_by_status",
  help: "Current number of bookings by status",
  labelNames: ["status"],
});

router.post("/prepare", verifyToken(["user"]), async (req, res) => {
  const timer = bookingDuration.startTimer({ operation: "payment_prepare" });
  try {
    const amount = req.body.currency === "USD" ? req.body.amount * 100 : req.body.amount; // Convert USD to cents
    const payment = await createPayment(amount, req.body.currency);
    bookingOperations.labels("payment_prepare", "success").inc();
    paymentOperations.labels("prepare", "success").inc();
    timer();
    res.json(payment);
  } catch (err) {
    bookingOperations.labels("payment_prepare", "failure").inc();
    paymentOperations.labels("prepare", "failure").inc();
    timer();
    res.status(500).json({ error: "Payment Creation Failed" });
  }
});

router.post("/confirm", verifyToken(["user"]), async (req, res) => {
  const timer = bookingDuration.startTimer({ operation: "booking_confirm" });
  try {
    const isValid = verifySignature(req.body);
    if (!isValid) {
      bookingOperations.labels("booking_confirm", "failure").inc();
      paymentOperations.labels("verify", "invalid_signature").inc();
      timer();
       res.status(400).json({ error: "Invalid signature" });
       return;
    }

    const booking = await Booking.create({
      ...req.body.details,
      userId: (req as any).user.id,
      status: "pending",
    });

    bookingOperations.labels("booking_confirm", "success").inc();
    paymentOperations.labels("verify", "success").inc();
    bookingsByStatus.labels("pending").inc();
    timer();
    res.json({ message: "Booking confirmed", booking });
  } catch (err) {
    bookingOperations.labels("booking_confirm", "failure").inc();
    paymentOperations.labels("verify", "failure").inc();
    timer();
    res.status(500).json({ message: "Can't Confirm Booking" });
  }
});

router.post("/", verifyToken(["user"]), async (req, res) => {
  const timer = bookingDuration.startTimer({ operation: "booking_create" });
  try {
    const booking = await Booking.create({
      ...req.body,
      userId: (req as any).user.id,
      status: "pending",
    });
    bookingOperations.labels("booking_create", "success").inc();
    bookingsByStatus.labels("pending").inc();
    timer();
    res.json({ message: "Booking saved", booking });
  } catch (err) {
    bookingOperations.labels("booking_create", "failure").inc();
    timer();
    res.status(500).json({ message: "Can't Save Booking" });
  }
});

router.get("/mine", verifyToken(["user"]), async (req, res) => {
  const timer = bookingDuration.startTimer({ operation: "get_user_bookings" });
  try {
    const bookings = await Booking.find({
      userId: (req as any).user.id,
    }).populate("doctorId");
    bookingOperations.labels("get_user_bookings", "success").inc();
    timer();
    res.json(bookings);
  } catch (err) {
    bookingOperations.labels("get_user_bookings", "failure").inc();
    timer();
    res.status(500).json({ message: "Can't get bookings" });
  }
});

router.get("/assigned", verifyToken(["doctor"]), async (req, res) => {
  const timer = bookingDuration.startTimer({
    operation: "get_doctor_bookings",
  });
  try {
    const bookings = await Booking.find({
      doctorId: (req as any).user.id,
    }).populate("userId");
    bookingOperations.labels("get_doctor_bookings", "success").inc();
    timer();
    res.json(bookings);
  } catch (err) {
    bookingOperations.labels("get_doctor_bookings", "failure").inc();
    timer();
    res.status(500).json({ message: "Can't get assigned doctor" });
  }
});

export default router;
