import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Google authentication callback
 * @route GET /google/callback
 * @access Public
 */
const googleAuthCallback = (req, res) => {
  const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
};

/**
 * @desc Admin login
 * @route POST /admin/login
 * @access Public
 */
const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const admin = await prisma.user.findUnique({ where: { username } });
    if (!admin) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    const validPassword = await bcrypt.compare(password, admin.password);

    if (!validPassword) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({
      status: "success",
      message: "Login successful",
      token,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }
};

/**
 * @desc Create admin account
 * @route POST /admin/create-account
 * @access Private (Admin/Manager)
 */
const createAdminAccount = async (req, res) => {
  const { username, password, role_id, manager_id } = req.body;

  const requesterRoleId = req.user.role_id;

  try {
    // If manager is creating, validate they can only create allowed role types
    if (requesterRoleId === 3 && ![2, 4].includes(role_id)) {
      return res.status(403).json({
        status: "error",
        message:
          "Managers can only create accounts for employees and property owners",
      });
    }

    // For employee creation, managerId is required
    if (requesterRoleId === 0 && role_id === 4 && !manager_id) {
      return res.status(400).json({
        status: "error",
        message: "Manager ID is required for employee creation",
      });
    }

    // If manager is creating, use their ID as managerId
    const effectiveManagerId = requesterRoleId === 3 ? req.user.id : manager_id;

    const hashedPassword = await bcrypt.hash(password, 10);

    // Use transaction to create both user and employee records
    await prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          role_id,
        },
      });

      // If role is employee, create employee record
      if (role_id === 4) {
        await prisma.employee.create({
          data: {
            user_id: user.id,
            manager: effectiveManagerId,
          },
        });
      }

      return user;
    });
    res.status(200).json({
      status: "success",
      message: "Account created successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }
};

export default { googleAuthCallback, adminLogin, createAdminAccount };
