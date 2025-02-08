import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const googleAuthCallback = (req, res) => {
  const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
};

const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const admin = await prisma.user.findUnique({ where: { username } });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

const createAdminAccount = async (req, res) => {
  const { username, password, role_id } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role_id,
      },
    });
    res.json({ message: "Account created successfully", admin: newAdmin });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

export default { googleAuthCallback, adminLogin, createAdminAccount };
