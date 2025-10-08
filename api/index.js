// API entry point for Vercel serverless deployment
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: "*",
  methods: ["*"],
  allowedHeaders: ["*"],
}));
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Antarnaa Backend Server is running!",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// API info endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "API is working!",
    availableRoutes: [
      "POST /auth/signup/initiate",
      "POST /auth/login",
      "POST /auth/forgot-password/send-otp"
    ]
  });
});

// AUTH ROUTES (without /api prefix to match frontend)
app.post("/auth/signup/initiate", async (req, res) => {
  try {
    console.log("Signup initiate request:", req.body);
    const { username, countryCode, number, email, dob, gender, password } = req.body;

    if (!username || !number || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    res.json({
      message: "Signup initiated successfully",
      data: { username, number, email }
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    console.log("Login request:", req.body);
    const { number, password } = req.body;

    if (!number || !password) {
      return res.status(400).json({ error: "Phone number and password are required" });
    }

    res.json({
      message: "Login successful",
      token: "test-token-12345",
      user: { number }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/auth/forgot-password/send-otp", async (req, res) => {
  try {
    console.log("Forgot password OTP request:", req.body);
    const { number } = req.body;

    if (!number) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    res.json({
      message: "OTP sent successfully to " + number
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// Catch-all handler for undefined routes
app.use("*", (req, res) => {
  console.log(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    path: req.originalUrl,
    availableRoutes: [
      "POST /auth/signup/initiate",
      "POST /auth/login",
      "POST /auth/forgot-password/send-otp"
    ]
  });
});

// Error handler middleware (must be last)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Export for Vercel
module.exports = app;