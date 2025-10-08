// src/models/User.ts
import { Schema, model } from "mongoose";

const UserSchema = new Schema({
  username: String,
  countryCode: { type: String, default: "+91" },
  number: String,
  email: String,
  dob: String,
  gender: String,
  password: String,
  role: { type: String, default: "user" },
  referralCode: { type: String, default: null },
  referralPercentage: { type: Number, default: null },
});

export default model("User", UserSchema);
