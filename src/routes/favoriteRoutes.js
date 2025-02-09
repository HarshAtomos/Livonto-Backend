import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import favoriteController from "../controllers/favoriteController.js";

const router = express.Router();

// All routes require user authentication
router.get(
  "/",
  isAuthenticated,
  requireRole([1]), // user only
  favoriteController.getFavorites
);

// Property favorite operations
router.post(
  "/:propertyId",
  isAuthenticated,
  requireRole([1]), // user only
  favoriteController.addToFavorites
);

router.delete(
  "/:propertyId",
  isAuthenticated,
  requireRole([1]), // user only
  favoriteController.removeFromFavorites
);

export default router;
