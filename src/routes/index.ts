import express from "express";
import userRoutes from "./userRoutes";
import doctorRoutes from "./doctorRoutes";
import adminRoutes from "./adminRoutes";

const router = express.Router();

router.use("/user", userRoutes);
router.use("/doctor", doctorRoutes);
router.use("/admin", adminRoutes);

export default router;
