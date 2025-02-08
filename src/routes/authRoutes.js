import express from "express";
import passport from "../config/passport.js";
import { requireRole } from "../middlewares/authMiddleware.js";
import authController from "../controllers/authController.js";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  authController.googleAuthCallback
);

router.post("/admin/login", authController.adminLogin);
router.post(
  "/admin/create-account",
  passport.authenticate("jwt", { session: false }),
  requireRole([0, 3]),
  authController.createAdminAccount
);

export default router;
