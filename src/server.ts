import dotenv from "dotenv";
import mongoose from "mongoose";
import client from "prom-client";
import app from "./app";

dotenv.config();
if (
  !process.env.TWILIO_SID ||
  !process.env.TWILIO_TOKEN ||
  !process.env.TWILIO_WA_FROM
) {
  console.error("❌ Twilio environment variables missing.");
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || "5000") || 5000;

// Add default metrics to the default registry
client.collectDefaultMetrics({
  prefix: "antarnaa_backend_",
});

// Create custom metrics using default registry
const httpRequestsTotal = new client.Counter({
  name: "antarnaa_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

// Add metrics middleware to app
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    httpRequestsTotal
      .labels(
        req.method,
        req.route?.path || req.path,
        res.statusCode.toString()
      )
      .inc();
  });

  next();
});

// Add health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Antarnaa Backend Server is running!",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Add metrics endpoint using default registry
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Metrics available at http://localhost:${PORT}/metrics`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
  });
