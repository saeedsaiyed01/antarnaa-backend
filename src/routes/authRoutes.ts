import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import SignupIntent from "../models/SignupIntent";
import { sendOtp } from "../utils/twilio";
import express, { Request, Response, RequestHandler } from "express";
import Doctor from "../models/Doctor";
import OtpRequest from "../models/OtpRequest";
import Admin from "../models/Admin";
import client from "prom-client";
import moment from "moment-timezone";
import { verifyToken } from "../middleware/auth";
import ReferralCode from "../models/ReferralCode";

const router = express.Router();

// Prometheus metrics
const authOperations = new client.Counter({
  name: "antarnaa_auth_operations_total",
  help: "Total number of authentication operations",
  labelNames: ["operation", "status", "user_type"],
});

const otpOperations = new client.Counter({
  name: "antarnaa_otp_operations_total",
  help: "Total number of OTP operations",
  labelNames: ["operation", "status"],
});

const authDuration = new client.Histogram({
  name: "antarnaa_auth_duration_seconds",
  help: "Duration of authentication operations",
  labelNames: ["operation"],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Register metrics with default registry
client.register.registerMetric(authOperations);
client.register.registerMetric(otpOperations);
client.register.registerMetric(authDuration);

router.post("/signup/initiate", async (req, res) => {
  const timer = authDuration.startTimer({ operation: "signup_initiate" });
  console.log(req.body);
  const { username, countryCode, number, email, dob, gender, password } =
    req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await SignupIntent.deleteMany({ number });

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await SignupIntent.create({
      username,
      number,
      email,
      dob,
      gender,
      password: hashedPassword,
      otp,
      expiresAt,
      countryCode,
    });
    console.log("Sending OTP to:", `${countryCode || "+91"}${number}`);
    await sendOtp(number, otp);
    console.log("From:", process.env.TWILIO_FROM);
    

    authOperations.labels("signup_initiate", "success", "user").inc();
    otpOperations.labels("send", "success").inc();
    timer();
    res.status(200).json({ message: "OTP sent" });
  } catch (err) {
    console.log(err);
    authOperations.labels("signup_initiate", "failure", "user").inc();
    otpOperations.labels("send", "failure").inc();
    timer();
    res.status(500).json({ error: "Signup initiation failed" });
  }
});

router.post(
  "/signup/verify",
  (async (req, res) => {
    const timer = authDuration.startTimer({ operation: "signup_verify" });
    let { countryCode, number, otp } = req.body;
    if (!countryCode) countryCode = "+91";
    try {
      const record = await SignupIntent.findOne({ number, countryCode });
      if (!record) {
        authOperations.labels("signup_verify", "failure", "user").inc();
        timer();
        res.status(400).json({ error: "No signup intent found" });
        return;
      }
      if (record.otp !== otp) {
        authOperations.labels("signup_verify", "failure", "user").inc();
        otpOperations.labels("verify", "invalid").inc();
        timer();
        res.status(400).json({ error: "Invalid OTP" });
        return;
      }
      if (new Date() > new Date(record.expiresAt)) {
        authOperations.labels("signup_verify", "failure", "user").inc();
        otpOperations.labels("verify", "expired").inc();
        timer();
        res.status(400).json({ error: "OTP expired" });
        return;
      }

      const existingUser = await User.findOne({ number, countryCode });
      if (existingUser) {
        authOperations.labels("signup_verify", "failure", "user").inc();
        timer();
        res.status(400).json({ error: "User already exists" });
        return;
      }

      const user = await User.create({
        username: record.username,
        number: record.number,
        countryCode: record.countryCode,
        email: record.email,
        dob: record.dob,
        gender: record.gender,
        password: record.password,
        role: "user",
      });

      await SignupIntent.deleteOne({ number, countryCode });

      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error("JWT_SECRET is not defined");
      const token = jwt.sign({ id: user._id }, secret);

      authOperations.labels("signup_verify", "success", "user").inc();
      otpOperations.labels("verify", "success").inc();
      timer();
      res.status(201).json({ token });
      return;
    } catch (err) {
      authOperations.labels("signup_verify", "failure", "user").inc();
      timer();
      res.status(500).json({ error: "OTP verification failed" });
      return;
    }
  }) as RequestHandler
);

router.post("/login", async (req, res) => {
  const timer = authDuration.startTimer({ operation: "login" });
  const { number, password } = req.body;
  let { countryCode } = req.body;
  if (!countryCode) countryCode = "+91";
  try {
    const user = await User.findOne({ number, countryCode });
    if (!user || !user.password) {
      authOperations.labels("login", "failure", "user").inc();
      timer();
      res.status(400).json({ error: "Invalid credentials" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      authOperations.labels("login", "failure", "user").inc();
      timer();
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not defined");

    const token = jwt.sign({ id: user._id, role: user.role }, secret);

    authOperations.labels("login", "success", "user").inc();
    timer();
    res.json({ token });
  } catch (err) {
    authOperations.labels("login", "failure", "user").inc();
    timer();
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/admin-login", async (req, res) => {
  const timer = authDuration.startTimer({ operation: "admin_login" });
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin || !admin.password) {
      authOperations.labels("login", "failure", "admin").inc();
      timer();
       res.status(404).json({ error: "Admin not found" });
       return;
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      authOperations.labels("login", "failure", "admin").inc();
      timer();
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET!
    );
    authOperations.labels("login", "success", "admin").inc();
    timer();
    res.json({ token });
  } catch (err) {
    authOperations.labels("login", "failure", "admin").inc();
    timer();
    res.status(500).json({ error: "Login failed" });
  }
});

// Doctor login
router.post("/doctor-login", async (req, res) => {
  const timer = authDuration.startTimer({ operation: "doctor_login" });
  const { number, password } = req.body;
  try {
    const doctor = await Doctor.findOne({ number });
    if (!doctor || !doctor.password) {
      authOperations.labels("login", "failure", "doctor").inc();
      timer();
       res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const match = await bcrypt.compare(password, doctor.password);
    if (!match) {
      authOperations.labels("login", "failure", "doctor").inc();
      timer();
       res.status(401).json({ error: "Invalid credentials" });
       return;
    }

    const token = jwt.sign(
      { id: doctor._id, role: "doctor" },
      process.env.JWT_SECRET!
    );
    authOperations.labels("login", "success", "doctor").inc();
    timer();
    res.json({ token });
  } catch (err) {
    authOperations.labels("login", "failure", "doctor").inc();
    timer();
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/forgot-password/send-otp", async (req, res) => {
  const timer = authDuration.startTimer({
    operation: "forgot_password_send_otp",
  });
  try {
    const { number } = req.body;
    let { countryCode } = req.body;
    if (!countryCode) countryCode = "+91";
    const user = await User.findOne({ number, countryCode });
    if (!user) {
      authOperations.labels("forgot_password", "failure", "user").inc();
      timer();
      res.status(404).json({ error: "User not found" });
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await OtpRequest.deleteMany({ number, countryCode });
    await OtpRequest.create({ number, otp, countryCode });

    await sendOtp(number, otp, countryCode);

    authOperations.labels("forgot_password", "success", "user").inc();
    otpOperations.labels("send", "success").inc();
    timer();
    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    authOperations.labels("forgot_password", "failure", "user").inc();
    otpOperations.labels("send", "failure").inc();
    timer();
    res.status(500).json({ error: "Can't send OTP" });
  }
});
router.post("/forgot-password/verify-otp", async (req, res) => {
  const timer = authDuration.startTimer({
    operation: "forgot_password_verify_otp",
  });
  try {
    const { number, otp } = req.body;
    let { countryCode } = req.body;
    if (!countryCode) countryCode = "+91";

    const record = await OtpRequest.findOne({ number, otp, countryCode });
    if (!record) {
      otpOperations.labels("verify", "invalid").inc();
      timer();
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    await OtpRequest.deleteMany({ number, countryCode });

    otpOperations.labels("verify", "success").inc();
    timer();
    res.json({ message: "OTP verified successfully" });
  } catch (err) {
    otpOperations.labels("verify", "failure").inc();
    timer();
    res.status(500).json({ error: "Can't send OTP" });
  }
});

router.post("/forgot-password/reset", async (req, res) => {
  const timer = authDuration.startTimer({ operation: "password_reset" });
  try {
    const { number, newPassword } = req.body;
    let { countryCode } = req.body;
    if (!countryCode) countryCode = "+91";
    const user = await User.findOne({ number, countryCode });
    if (!user) {
      authOperations.labels("password_reset", "failure", "user").inc();
      timer();
       res.status(404).json({ error: "User not found" });
       return;
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    authOperations.labels("password_reset", "success", "user").inc();
    timer();
    res.json({ message: "Password reset successfully" });
  } catch (err) {
    authOperations.labels("password_reset", "failure", "user").inc();
    timer();
    res.status(500).json({ error: "Can't Reset Password" });
  }
});

router.get(
  "/time-slots",
  async (req: Request, res: Response) => {
    try {


      // Get user's timezone from query parameter or default to "Asia/Kolkata"
      const userTimezone = req.query.timezone as string;
      console.log("User timezone:", userTimezone);
      // Validate the timezone
      if (!moment.tz.zone(userTimezone)) {
        res.status(400).json({ error: "Invalid timezone" });
      return;
      }


      const startTime = moment.tz("09:00", "HH:mm", "Asia/Kolkata");
      const endTime = moment.tz("21:00", "HH:mm", "Asia/Kolkata");

      // Convert to system timezone
      const slots = [];
      let currentTime = startTime.clone();
      while (currentTime.isBefore(endTime)) {
        slots.push(currentTime.tz(userTimezone).format("HH:mm"));
        currentTime.add(1, "hour");
      }

      res.json({ slots });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch time slots" });
    }
  }
);

router.get("/users", verifyToken(["admin"]), async (req, res) => {
  try {
    const users = await User.find({}, "username number dob");
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/users/referral-code", verifyToken(["admin"]), async (req, res) => {
  const { userName, email, referralCode, percentage } = req.body;

  try {
    const newReferral = new ReferralCode({
      userName,
      email,
      referralCode,
      percentage,
    });

    await newReferral.save();

    res.json({ message: "Referral code saved successfully", referralCode });
  } catch (error) {
    console.error("Error saving referral code:", error);
    res.status(500).json({ error: "Failed to save referral code" });
  }
});

router.get("/users-with-referral", verifyToken(["admin"]), async (req, res) => {
  try {
    const referralCodes = await ReferralCode.find({});
    res.status(200).json(referralCodes);
  } catch (error) {
    console.error("Error fetching referral codes:", error);
    res.status(500).json({ message: "Failed to fetch referral codes" });
  }
});

// Increment referral code count
router.post("/users/referral-code-count", async (req, res) => {
  const { referralCode } = req.body;

  try {
    const referral = await ReferralCode.findOne({ referralCode });
    if (!referral) {
       res.status(404).json({ error: "Referral code not found" });
       return;
    }

    referral.count = (referral.count || 0) + 1;
    await referral.save();

    res.json({ message: "Referral code count updated successfully" });
  } catch (error) {
    console.error("Error updating referral code count:", error);
    res.status(500).json({ error: "Failed to update referral code count" });
  }
});

export default router;


