import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { PrismaClient, user_role } from "@prisma/client";
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

// TODO: blocking if failed to login multiple times
/**
 * @desc Admin login
 * @route POST /admin/login
 * @access Public
 */
const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if input is email or username
    const admin = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }, // Check if the provided username is actually an email
        ],
      },
    });

    if (!admin) {
      console.log("Invalid credentials");
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    const validPassword = await bcrypt.compare(password, admin.password);

    if (!validPassword) {
      console.log("Invalid credentials");
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
    console.error(err);
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
  const { name, username, email, password, role, phone } = req.body;

  try {
    // Validate required fields
    if (!username || !password || !role) {
      console.log("Please provide all required fields");
      return res.status(400).json({
        status: "error",
        message: "Please provide all required fields",
      });
    }

    // Role-based permission check
    if (req.user.role === user_role.MANAGER) {
      // Managers can only create EMPLOYEE
      if (role !== user_role.EMPLOYEE) {
        console.log("Managers can only create employee accounts");
        return res.status(403).json({
          status: "error",
          message: "Managers can only create employee accounts",
        });
      }
    } else if (req.user.role === user_role.ADMIN) {
      // Admins can create MANAGER, PROPERTY_OWNER, EMPLOYEE
      const adminAllowedRoles = [
        user_role.MANAGER,
        user_role.PROPERTY_OWNER,
        user_role.EMPLOYEE,
      ];
      if (!adminAllowedRoles.includes(role)) {
        console.log("Invalid role specified");
        return res.status(403).json({
          status: "error",
          message: "Invalid role specified",
        });
      }
    } else {
      console.log("Insufficient permissions");
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    // Check if username already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: email ? email : undefined }],
      },
    });

    if (existingUser) {
      console.log("Username or email already exists");
      return res.status(400).json({
        status: "error",
        message: "Username or email already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Set managerId for employees
    let managerId = null;
    if (role === user_role.EMPLOYEE) {
      managerId = req.user.id;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
        role,
        phone,
        managerId,
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      status: "success",
      message: "Account created successfully",
      data: userWithoutPassword,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }
};

/**
 * @desc Delete admin account
 * @route DELETE /admin/delete-account/:id
 * @access Private (Admin/Manager)
 */
const deleteAdminAccount = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the account to be deleted
    const accountToDelete = await prisma.user.findUnique({
      where: { id },
    });

    if (!accountToDelete) {
      return res.status(404).json({
        status: "error",
        message: "Account not found",
      });
    }

    // Role-based permission check
    if (req.user.role === user_role.MANAGER) {
      // Managers can only delete their employee accounts
      if (
        accountToDelete.role !== user_role.EMPLOYEE ||
        accountToDelete.managerId !== req.user.id
      ) {
        console.log("Managers can only delete their employee accounts");
        return res.status(403).json({
          status: "error",
          message: "You can only delete employee accounts that you manage",
        });
      }
    } else if (req.user.role !== user_role.ADMIN) {
      console.log("Insufficient permissions");
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    // Delete the user
    await prisma.user.delete({
      where: { id },
    });

    return res.status(200).json({
      status: "success",
      message: "Account deleted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }
};

export default {
  googleAuthCallback,
  adminLogin,
  createAdminAccount,
  deleteAdminAccount,
};
