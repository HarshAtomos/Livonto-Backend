import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import propertyController from "../controllers/propertyController.js";

const router = express.Router();

// Public routes
router.get("/", propertyController.getProperties);

router.get("/info/:id", propertyController.getPropertyInfo);

// Protected routes with role-based access

router.get(
  "/admin",
  isAuthenticated,
  requireRole([0, 2, 3]), // admin, property_owner, manager
  propertyController.getAdminProperties
);

router.post(
  "/request",
  isAuthenticated,
  requireRole([0, 2, 3, 1]), // admin, property_owner, manager, user
  propertyController.createPropertyRequest
);

router.get(
  "/admin/requests",
  isAuthenticated,
  requireRole([0, 3]), // admin, manager
  propertyController.getPendingRequests
);

router.patch(
  "/admin/requests/:id",
  isAuthenticated,
  requireRole([0]), // admin only
  propertyController.updateRequestStatus
);

router.patch(
  "/admin/:id",
  isAuthenticated,
  requireRole([0, 2, 3]), // admin, property_owner, manager
  propertyController.updatePropertyDetails
);

router.post(
  "/admin/:id/rooms",
  isAuthenticated,
  requireRole([0, 3]), // admin, manager
  propertyController.updateRoomType
);

router.patch(
  "/admin/:id/rooms/:roomId/availability",
  isAuthenticated,
  requireRole([0, 2, 3]), // admin, property_owner, manager
  propertyController.updateRoomAvailability
);

export default router;
