import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import complaintController from "../controllers/complaintController.js";

const router = express.Router();

// Protected routes - all require authentication
router.get(
  "/",
  isAuthenticated,
  complaintController.getComplaints // Access controlled within controller based on role
);

// Create complaint - only users and property owners can create
router.post(
  "/create",
  isAuthenticated,
  requireRole([1, 2]), // user, property_owner
  complaintController.createComplaint
);

// Update complaint - admin/manager only
router.patch(
  "/admin/:id",
  isAuthenticated,
  requireRole([0, 3]), // admin, manager
  complaintController.updateComplaint
);

export default router;
