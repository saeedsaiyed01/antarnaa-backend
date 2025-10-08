// src/routes/prescriptionRoutes.ts
import express from "express";
import Prescription from "../models/Prescription";
import { verifyToken } from "../middleware/auth";
import Medicine from "../models/Medicine";
import Booking from "../models/Booking";
import client from "prom-client";
import Doctor from "../models/Doctor";
import User from "../models/User";

const router = express.Router();

// Prometheus metrics
const prescriptionOperations = new client.Counter({
  name: "antarnaa_prescription_route_operations_total",
  help: "Total number of prescription route operations",
  labelNames: ["operation", "status"],
});

const prescriptionDuration = new client.Histogram({
  name: "antarnaa_prescription_route_duration_seconds",
  help: "Duration of prescription route operations",
  labelNames: ["operation"],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const medicineOperations = new client.Counter({
  name: "antarnaa_medicine_operations_total",
  help: "Total number of medicine operations",
  labelNames: ["operation", "status"],
});

const prescriptionsByType = new client.Gauge({
  name: "antarnaa_prescriptions_by_type",
  help: "Current number of prescriptions by operation type",
  labelNames: ["type"],
});

// Create or update prescription
router.post("/", verifyToken(["doctor"]), async (req, res) => {
  const timer = prescriptionDuration.startTimer({
    operation: "create_update_prescription",
  });
  try {
    const {
      bookingId,
      chiefComplaint,
      diagnosis,
      medicines,
      advice,
      followup,
    } = req.body;
    const doctorId = (req as any).user.id;

    const existing = await Prescription.findOne({ bookingId });
    if (existing) {
      await Prescription.updateOne(
        { bookingId },
        { chiefComplaint, diagnosis, medicines, advice, followup }
      );
      prescriptionOperations.labels("update_prescription", "success").inc();
      prescriptionsByType.labels("update").inc();
      timer();
       res.json({ message: "Prescription updated" });
       return;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      prescriptionOperations
        .labels("create_prescription", "booking_not_found")
        .inc();
      timer();
       res.status(404).json({ error: "Booking not found" });
       return;
    }

    const patientId = booking.userId;

    const pres = await Prescription.create({
      bookingId,
      doctorId,
      patientId,
      chiefComplaint,
      diagnosis,
      medicines,
      advice,
      followup,
    });

    // Save any new medicines
    for (const m of medicines) {
      try {
        const exists = await Medicine.findOne({ name: m.name });
        if (!exists) {
          await Medicine.create({ name: m.name });
          medicineOperations.labels("create", "success").inc();
        }
      } catch (medicineErr) {
        medicineOperations.labels("create", "failure").inc();
        console.error("Error saving medicine:", medicineErr);
      }
    }

    prescriptionOperations.labels("create_prescription", "success").inc();
    prescriptionsByType.labels("create").inc();
    timer();
    res.json({ message: "Prescription saved", pres });
  } catch (err) {
    console.error("Error saving prescription:", err);
    prescriptionOperations.labels("create_prescription", "failure").inc();
    timer();
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get prescription for a booking
router.get(
  "/:bookingId",
  verifyToken(["doctor", "user", "admin"]),
  async (req, res) => {
    const timer = prescriptionDuration.startTimer({
      operation: "get_prescription",
    });
    try {
      const pres = await Prescription.findOne({
        bookingId: req.params.bookingId,
      });
      if (!pres) {
        prescriptionOperations.labels("get_prescription", "not_found").inc();
        timer();
         res.status(404).json({ error: "Not found" });
         return;
      }
      prescriptionOperations.labels("get_prescription", "success").inc();
      timer();
      res.json(pres);
    } catch (err) {
      console.error("Error fetching prescription:", err);
      prescriptionOperations.labels("get_prescription", "failure").inc();
      timer();
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// Get prescriptions for a user
router.get(
  "/user/:userId",
  verifyToken(["user", "admin"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const prescriptions = await Prescription.find({ patientId: userId }).lean();

      if (!prescriptions || prescriptions.length === 0) {
        res.status(404).json({ error: "No prescriptions found for this user" });
        return;
      }

      const enrichedPrescriptions = await Promise.all(
        prescriptions.map(async (prescription) => {
          const doctor = await Doctor.findById(prescription.doctorId).lean();
          const patient = await User.findById(prescription.patientId).lean();

          // Format the createdAt date to YYYY-MM-DD
          const formattedDate = new Date(prescription.createdAt).toISOString().split("T")[0];

          return {
            ...prescription,
            doctorName: doctor?.name || "Unknown",
            doctorDegree: doctor?.degree || "N/A",
            doctorRegistrationNumber: doctor?.registrationNumber || "N/A",
            doctorPrescriptionId: doctor?.prescriptionId || null,
            patientName: patient?.username || "Unknown",
            image: doctor?.image || null,
            date: formattedDate, // Add formatted date
          };
        })
      );

      res.status(200).json(enrichedPrescriptions);
    } catch (error) {
      res.status(500).json({ error: "An error occurred while fetching prescriptions" });
    }
  }
);

// Get all medicines (for dropdown)
router.get("/medicines/all", async (req, res) => {
  const timer = prescriptionDuration.startTimer({ operation: "get_medicines" });
  try {
    const meds = await Medicine.find().sort("name");
    medicineOperations.labels("get_all", "success").inc();
    timer();
    res.json(meds);
  } catch (err) {
    console.error("Error fetching medicines:", err);
    medicineOperations.labels("get_all", "failure").inc();
    timer();
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
