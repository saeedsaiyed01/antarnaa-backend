import mongoose from "mongoose";

const signupIntentSchema = new mongoose.Schema(
  {
    username: String,
    countryCode: {
      type: "String",
      default: "+91",
    },
    number: String,
    email: String,
    dob: String,
    gender: String,
    password: String,
    otp: String,
    expiresAt: Date,
  },
  { timestamps: true }
);

export default mongoose.models.SignupIntent ||
  mongoose.model("SignupIntent", signupIntentSchema);
