import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import profileController from "../controllers/profileController.js";
import { checkProfileCompletion } from "../middlewares/profileMiddleware.js";
import { user_role } from "@prisma/client"; // Import the enum

const router = express.Router();

router.get(
  "/",
  isAuthenticated,
  checkProfileCompletion,
  profileController.getProfile
);
router.put("/update", isAuthenticated, profileController.updateProfile);
router.get(
  "/all",
  isAuthenticated,
  requireRole([user_role.ADMIN, user_role.MANAGER]),
  profileController.getAllUsers
);

export default router;
