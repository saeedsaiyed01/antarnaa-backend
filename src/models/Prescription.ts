import { Schema, model } from "mongoose";

const PrescriptionSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    diagnosis: { type: String },
    treatment: { type: String },
    diet: { type: String },
    investigations: { type: String },
    followup: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

export default model("Prescription", PrescriptionSchema);
