import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import amenityHouseRuleController from "../controllers/amenityHouseRuleController.js";
import { user_role } from "@prisma/client";

const router = express.Router();

router.get("/amenities", amenityHouseRuleController.getAllAmenities);

router.post(
  "/amenities",
  isAuthenticated,
  requireRole([user_role.ADMIN]),
  amenityHouseRuleController.createAmenity
);

router.put(
  "/amenities/:id",
  isAuthenticated,
  requireRole([user_role.ADMIN]),
  amenityHouseRuleController.updateAmenity
);

router.delete(
  "/amenities/:id",
  isAuthenticated,
  requireRole([user_role.ADMIN]),
  amenityHouseRuleController.deleteAmenity
);

router.get("/house-rules", amenityHouseRuleController.getAllHouseRules);

router.post(
  "/house-rules",
  isAuthenticated,
  requireRole([user_role.ADMIN]),
  amenityHouseRuleController.createHouseRule
);

router.put(
  "/house-rules/:id",
  isAuthenticated,
  requireRole([user_role.ADMIN]),
  amenityHouseRuleController.updateHouseRule
);

router.delete(
  "/house-rules/:id",
  isAuthenticated,
  requireRole([user_role.ADMIN]),
  amenityHouseRuleController.deleteHouseRule
);

export default router;
