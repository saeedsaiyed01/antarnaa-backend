// src/models/Doctor.ts
import { Schema, model } from "mongoose";

const DoctorSchema = new Schema({
  name: String,
  number: String,
  email: String,
  password: String,
  experience: String,
  speciality: String,
  image: { type: String },
  role: { type: String, default: "doctor" },
  availability: { type: Map, of: [String], default: {} },
  roomId: { type: String, required: false },
  registrationNumber: { type: String, required: false },
  degree: { type: String, required: false },
  prescriptionId: { type: String, required: true },
});

export default model("Doctor", DoctorSchema);
