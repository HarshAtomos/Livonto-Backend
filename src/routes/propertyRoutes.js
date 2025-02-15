import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import propertyController from "../controllers/propertyController.js";
import { user_role } from "@prisma/client";

const router = express.Router();

router.post(
  "/create",
  isAuthenticated,
  requireRole([user_role.ADMIN, user_role.PROPERTY_OWNER]),
  propertyController.createProperty
);

router.get("/all", propertyController.getAllProperties);

router.get("/detail/:id", propertyController.getPropertyById);

router.put(
  "/update/:id",
  isAuthenticated,
  requireRole([user_role.ADMIN]),
  propertyController.updateProperty
);

router.delete(
  "/delete/:id",
  isAuthenticated,
  requireRole([user_role.ADMIN]),
  propertyController.deleteProperty
);

router.patch(
  "/rooms/:roomId",
  isAuthenticated,
  requireRole([user_role.ADMIN, user_role.PROPERTY_OWNER]),
  propertyController.updateRoomDetails
);

router.put(
  "/status/:id",
  isAuthenticated,
  requireRole([user_role.ADMIN]),
  propertyController.updatePropertyStatus
);
export default router;
