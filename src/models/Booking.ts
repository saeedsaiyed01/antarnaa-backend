// src/models/Booking.ts
import { Schema, model } from "mongoose";

const BookingSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: String,
  time: String,
  speciality: String,
  chiefComplaint: String,
  status: { type: String, enum: ["confirmed", "pending"], default: "pending" },
  doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", default: null },
  videoLink:{
    doctor: { type: String, default: null },
    user: { type: String, default: null }
  },
});

export default model("Booking", BookingSchema);
