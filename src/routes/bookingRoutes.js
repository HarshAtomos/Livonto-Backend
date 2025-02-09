import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import bookingController from "../controllers/bookingController.js";

const router = express.Router();

// Protected routes - all booking routes require authentication
router.get(
  "/",
  isAuthenticated,
  bookingController.getBookings // Access controlled within controller based on role
);

// Property booking routes
router.post(
  "/admin/properties/:propertyId/rooms/:roomId/book/:guestId",
  isAuthenticated,
  requireRole([0, 3]), // admin, manager only
  bookingController.createBooking
);

// Booking status management
router.patch(
  "/admin/:id/status",
  isAuthenticated,
  requireRole([0, 3]), // admin, manager only
  bookingController.updateBookingStatus
);

export default router;
