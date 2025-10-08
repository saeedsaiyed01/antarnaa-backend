// API entry point for Vercel serverless deployment
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('../dist/routes/authRoutes');
const userRoutes = require('../dist/routes/userRoutes');
const doctorRoutes = require('../dist/routes/doctorRoutes');
const adminRoutes = require('../dist/routes/adminRoutes');
const bookingRoutes = require('../dist/routes/bookingRoutes');
const prescriptionRoutes = require('../dist/routes/prescriptionRoutes');
const morgan = require('morgan');
const path = require('path');

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
app.use(morgan("dev"));
app.use(express.json());

// Serve static files from the 'uploads' directory
app.use("/api/uploads", express.static(path.join(__dirname, "../../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/prescriptions", prescriptionRoutes);

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