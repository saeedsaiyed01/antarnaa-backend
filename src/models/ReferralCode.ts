import mongoose from "mongoose";

const ReferralCodeSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  email: { type: String, required: true },
  referralCode: { type: String, required: true, unique: true },
  percentage: { type: Number, required: true },
  count: { type: Number, default: 0 },
});

const ReferralCode = mongoose.model("ReferralCode", ReferralCodeSchema);

export default ReferralCode;
