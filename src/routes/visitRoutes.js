import express from "express";
import { isAuthenticated, requireRole } from "../middlewares/authMiddleware.js";
import { checkProfileCompletion } from "../middlewares/profileMiddleware.js";
import visitController from "../controllers/visitController.js";
import { user_role } from "@prisma/client";

const router = express.Router();

router.post(
  "/create",
  isAuthenticated,
  checkProfileCompletion,
  requireRole([user_role.USER, user_role.ADMIN, user_role.MANAGER]),
  visitController.createVisit
);
router.get("/all", isAuthenticated, visitController.getVisits);
router.put(
  "/update/:id",
  isAuthenticated,
  requireRole([
    user_role.ADMIN,
    user_role.MANAGER,
    user_role.EMPLOYEE,
    user_role.USER,
  ]),
  visitController.updateVisitStatus
);
router.put(
  "/assign-employee/:id",
  isAuthenticated,
  requireRole([user_role.ADMIN, user_role.MANAGER]),
  visitController.assignEmployee
);

export default router;
