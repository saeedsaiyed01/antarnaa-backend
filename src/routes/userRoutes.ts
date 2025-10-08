import express from "express";
import { verifyToken } from "../middleware/auth";
import User from "../models/User";
import PDFDocument from "pdfkit";
import Booking from "../models/Booking";
import Prescription from "../models/Prescription";
import client from "prom-client";
import ReferralCode from "../models/ReferralCode";

const router = express.Router();

// Prometheus metrics
const userOperations = new client.Counter({
  name: "antarnaa_user_operations_total",
  help: "Total number of user operations",
  labelNames: ["operation", "status"],
});

const userDuration = new client.Histogram({
  name: "antarnaa_user_duration_seconds",
  help: "Duration of user operations",
  labelNames: ["operation"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const pdfGenerations = new client.Counter({
  name: "antarnaa_pdf_generations_total",
  help: "Total number of PDF generations",
  labelNames: ["status"],
});

const profileUpdates = new client.Counter({
  name: "antarnaa_profile_updates_total",
  help: "Total number of profile updates",
  labelNames: ["status"],
});

// Get user profile
router.get("/me", verifyToken(["user"]), async (req, res) => {
  const timer = userDuration.startTimer({ operation: "get_profile" });
  try {
    // @ts-ignore
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      userOperations.labels("get_profile", "not_found").inc();
      timer();
       res.status(404).json({ error: "No such user" });
       return;
    }

    console.log(user);

    userOperations.labels("get_profile", "success").inc();
    timer();
    res.json({
      username: user.username,
      email: user.email,
      dob: user.dob,
      number: user.number,
      countryCode: user.countryCode || "+91",
      gender: user.gender,
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    userOperations.labels("get_profile", "failure").inc();
    timer();
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get all bookings for logged-in user
router.get("/bookings", verifyToken(["user"]), async (req, res) => {
  const timer = userDuration.startTimer({ operation: "get_bookings" });
  try {
    // @ts-ignore
    const bookings = await Booking.find({ userId: req.user.id }).sort({
      date: -1,
    });
    console.log(bookings);
    userOperations.labels("get_bookings", "success").inc();
    timer();
    res.json(bookings);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    userOperations.labels("get_bookings", "failure").inc();
    timer();
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get(
  "/prescription/pdf/:bookingId",
  verifyToken(["user"]),
  async (req, res) => {
    const timer = userDuration.startTimer({ operation: "generate_pdf" });
    try {
      const { bookingId } = req.params;
      const prescription = await Prescription.findOne({ bookingId });
      if (!prescription) {
        userOperations.labels("generate_pdf", "prescription_not_found").inc();
        pdfGenerations.labels("prescription_not_found").inc();
        timer();
        res.status(404).json({ error: "Prescription not found" });
        return;
      }

      const booking = await Booking.findById(bookingId)
        .populate("doctorId")
        .populate("userId");
      if (!booking || !booking.userId || !booking.doctorId) {
        userOperations.labels("generate_pdf", "booking_invalid").inc();
        pdfGenerations.labels("booking_invalid").inc();
        timer();
         res
          .status(400)
          .json({ error: "Invalid booking or related info" });
          return;
      }

      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="prescription-${bookingId}.pdf"`
      );

      doc.pipe(res);

      doc
        .fontSize(20)
        .text("Ayurvedic Prescription", { align: "center" })
        .moveDown();
      // @ts-ignore
      doc.fontSize(12).text(`Doctor: Dr. ${booking.doctorId.name}`);
      // @ts-ignore
      doc.text(`Patient: ${booking.userId.username}`);
      doc.text(`Date: ${booking.date}`);
      doc.text(`Time: ${booking.time}`).moveDown();

      doc.fontSize(14).text("Details", { underline: true }).moveDown(0.5);
      const fields = [
        ["Diagnosis", prescription.diagnosis],
        ["Treatment", prescription.treatment],
        ["Diet", prescription.diet],
        ["Investigations", prescription.investigations],
        ["Follow-Up", prescription.followup],
        ["Notes", prescription.notes],
      ];

      fields.forEach(([label, value]) => {
        if (value)
          doc
            .font("Helvetica-Bold")
            .text(`${label}: `, { continued: true })
            .font("Helvetica")
            .text(value);
      });

      doc.end();
      userOperations.labels("generate_pdf", "success").inc();
      pdfGenerations.labels("success").inc();
      timer();
    } catch (err) {
      console.error("Error generating PDF:", err);
      userOperations.labels("generate_pdf", "failure").inc();
      pdfGenerations.labels("failure").inc();
      timer();
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }
);

// Get referral percentage by referral code
router.get("/referral/:referralCode", verifyToken(["user"]), async (req, res) => {
  try {
    const { referralCode } = req.params;
    const referral = await ReferralCode.findOne({ referralCode: new RegExp(`^${referralCode}$`, "i") });
    console.log("ReferralCode", referral);
    if (!referral) {
      res.status(404).json({ error: "Invalid referral code" });
      return;
    }

    res.status(200).json({ referralPercentage: referral.percentage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch referral percentage" });
  }
});

// Validate referral code and get percentage
router.get("/validate-referral", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
       res.status(400).json({ error: "Referral code is required" });
       return;
    }

    const referral = await ReferralCode.findOne({ referralCode: new RegExp(`^${code}$`, "i") });
    if (!referral) {
       res.status(404).json({ error: "Invalid referral code" });
       return;
    }

    res.status(200).json({ discountPercentage: referral.percentage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to validate referral code" });
  }
});

router.put("/update", verifyToken(["user"]), async (req, res) => {
  const timer = userDuration.startTimer({ operation: "update_profile" });
  const { username, dob, gender, email } = req.body;
  console.log(username);
  // @ts-ignore
  const userId = req.user.id;

  // Simple field validation
  if (!username || !dob || !gender) {
    userOperations.labels("update_profile", "invalid_input").inc();
    profileUpdates.labels("invalid_input").inc();
    timer();
     res
      .status(400)
      .json({ error: "All fields except email are required" });
      return;
  }

  try {
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      userOperations.labels("update_profile", "user_not_found").inc();
      profileUpdates.labels("user_not_found").inc();
      timer();
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Prevent changing phone number
    if (req.body.number && req.body.number !== existingUser.number) {
      userOperations.labels("update_profile", "phone_change_denied").inc();
      profileUpdates.labels("phone_change_denied").inc();
      timer();
     res.status(400).json({ error: "Phone number cannot be changed" });
     return;
    }

    // Apply updates
    existingUser.username = username;
    existingUser.dob = dob;
    existingUser.gender = gender;
    if (email) existingUser.email = email;

    await existingUser.save();

    userOperations.labels("update_profile", "success").inc();
    profileUpdates.labels("success").inc();
    timer();
    res.json({
      message: "User updated successfully",
      user: existingUser,
    });
    return;
  } catch (err: any) {
    console.error("User update error:", err);
    if (err.code === 11000) {
      userOperations.labels("update_profile", "email_duplicate").inc();
      profileUpdates.labels("email_duplicate").inc();
      timer();
       res.status(409).json({ error: "Email already in use" });
       return;
    }
    userOperations.labels("update_profile", "failure").inc();
    profileUpdates.labels("failure").inc();
    timer();
    res.status(500).json({ error: "Server error" });
    return;
  }
});

export default router;
