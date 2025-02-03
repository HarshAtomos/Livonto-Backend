import jwt from "jsonwebtoken";
import passport from "../config/passport.js";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const googleAuthCallback = (req, res) => {
  const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  //   res.json({ token });
  res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
};

export default { googleAuthCallback };
