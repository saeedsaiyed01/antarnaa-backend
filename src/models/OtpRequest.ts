// models/OtpRequest.ts
import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  number: { type: String, required: true },
  otp: { type: String, required: true },
  countryCode: { type: String, default: "+91" },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // auto-delete after 5 min
});

export default mongoose.model("OtpRequest", otpSchema);
