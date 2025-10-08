// src/models/Admin.ts
import { Schema, model } from "mongoose";

const AdminSchema = new Schema({
  username: String,
  email: String,
  password: String,
  role: { type: String, default: "admin" },
});

export default model("Admin", AdminSchema);
