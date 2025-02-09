import express from "express";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import reviewController from "../controllers/reviewController.js";

const router = express.Router();

// Public routes
router.get("/:propertyId", reviewController.getPropertyReviews);

// Protected routes
router.post("/:propertyId", isAuthenticated, reviewController.createReview);

// Review management routes
router.patch("/:id", isAuthenticated, reviewController.updateReview);

router.delete("/:id", isAuthenticated, reviewController.deleteReview);

export default router;
