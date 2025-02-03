import express from "express";
import passport from "../config/passport.js";
import adminController from "../controllers/adminController.js";
import { requireRole } from "../middlewares/authMiddleware.js";
const router = express.Router();

router.post("/admin/login", adminController.adminLogin);
router.post(
  "/admin/create-account",
  passport.authenticate("jwt", { session: false }),
  requireRole("root"),
  adminController.createAdminAccount
);

export default router;
