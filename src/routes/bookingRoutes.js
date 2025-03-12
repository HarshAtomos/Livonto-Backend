import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import { checkProfileCompletion } from "../middlewares/profileMiddleware.js";
import bookingController from "../controllers/bookingController.js";
import { user_role } from "@prisma/client";

const router = express.Router();

router.post(
  "/create",
  isAuthenticated,
  checkProfileCompletion,
  requireRole([user_role.USER, user_role.ADMIN, user_role.MANAGER]),
  bookingController.createBooking
);
router.get(
  "/",
  isAuthenticated,
  requireRole([user_role.ADMIN, user_role.MANAGER]),
  bookingController.getAllBookings
);
router.get("/:id", isAuthenticated, bookingController.getABooking);
router.get(
  "/scanner/:id",
  isAuthenticated,
  bookingController.getABookingForScanner
);
router.patch(
  "/:id/activate",
  isAuthenticated,
  requireRole([user_role.ADMIN, user_role.MANAGER]),
  bookingController.activateBooking
);
// router.put(
//   "/assign-employee/:id",
//   isAuthenticated,
//   requireRole([user_role.ADMIN, user_role.MANAGER]),
//   bookingController.assignEmployee
// );

export default router;
