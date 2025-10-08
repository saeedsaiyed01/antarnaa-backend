// src/models/Medicine.ts
import { Schema, model } from "mongoose";

const medicineSchema = new Schema({
  name: { type: String, unique: true },
});

export default model("Medicine", medicineSchema);
