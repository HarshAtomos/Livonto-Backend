import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import visitController from "../controllers/visitController.js";

const router = express.Router();

// Protected routes - all require authentication
router.get(
  "/",
  isAuthenticated,
  visitController.getVisits // Access controlled within controller based on role
);

// Create visit request - users only
router.post(
  "/",
  isAuthenticated,
  requireRole([1]), // user only
  visitController.createVisitRequest
);

// Visit management routes
router.patch(
  "/admin/:id",
  isAuthenticated,
  requireRole([0, 3, 4]), // admin, manager, employee
  visitController.updateVisit
);

// Visit feedback
router.post("/:id", isAuthenticated, visitController.addVisitFeedback);

export default router;
