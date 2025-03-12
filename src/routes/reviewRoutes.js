import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import { checkProfileCompletion } from "../middlewares/profileMiddleware.js";
import reviewController from "../controllers/reviewController.js";
import { user_role } from "@prisma/client";

const router = express.Router();

router.post(
  "/",
  isAuthenticated,
  requireRole([user_role.USER, user_role.ADMIN]),
  // checkProfileCompletion,
  reviewController.createReview
);
router.get("/:propertyId", reviewController.getReviews);
router.get(
  "/user/:propertyId",
  isAuthenticated,
  reviewController.getUserReviews
);
router.put(
  "/:id",
  isAuthenticated,
  requireRole([user_role.USER, user_role.ADMIN]),
  reviewController.updateReview
);
router.delete(
  "/:id",
  isAuthenticated,
  requireRole([user_role.USER, user_role.ADMIN]),
  reviewController.deleteReview
);
export default router;
