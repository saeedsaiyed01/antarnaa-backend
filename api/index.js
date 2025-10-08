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
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/",
      api: "/api/*"
    }
  });
});

// API test endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "API is working!",
    availableRoutes: [
      "POST /api/auth/signup/initiate",
      "POST /api/auth/login",
      "POST /api/auth/doctor-login",
      "POST /api/auth/admin-login"
    ]
  });
});

// Simple signup route for testing
app.post("/api/auth/signup/initiate", async (req, res) => {
  try {
    const { username, countryCode, number, email, dob, gender, password } = req.body;

    if (!username || !number || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // For now, just return success - implement full logic later
    res.json({
      message: "Signup initiated successfully",
      data: { username, number, email }
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Antarnaa Backend Server is running!",
    status: "healthy",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/",
      metrics: "/metrics",
      api: "/api/*"
    }
  });
});

// API test endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "API is working!",
    routes: [
      "/api/auth/signup/initiate",
      "/api/auth/login",
      "/api/auth/doctor-login",
      "/api/auth/admin-login"
    ]
  });
});

// Error handler middleware (must be last)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Export for Vercel
module.exports = app;