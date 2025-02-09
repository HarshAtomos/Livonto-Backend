import express from "express";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import profileController from "../controllers/profileController.js";

const router = express.Router();

router.put("/update", isAuthenticated, profileController.updateProfile);

export default router;
