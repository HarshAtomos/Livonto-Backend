import { PrismaClient, user_role } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Get user profile
 * @route GET /profile
 * @access Private
 */
const getProfile = async (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Profile fetched successfully",
    data: req.profile,
  });
};

/**
 * @desc Update user profile
 * @route PUT /profile/update
 * @access Private
 */

const updateProfile = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    const {
      name,
      phone,
      address,
      occupation,
      city,
      profileImage,
      gender,
      email,
    } = req.body;

    if (role === user_role.USER && email !== req.user.email) {
      return res.status(403).json({
        status: "error",
        message: "You cannot update your email",
      });
    }
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
        phone,
        city,
        address,
        profileImage,
        occupation,
        gender,
        email,
      },
    });
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: userWithoutPassword,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "Failed to update profile",
    });
  }
};

/**
 * @desc Get all users (with role-based access)
 * @route GET /profile/all
 * @access Private (Admin & Manager only)
 */
const getAllUsers = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    const { roles = ["MANAGER"] } = req.query; // Default to showing managers

    // Convert single role to array if needed
    const roleFilters = Array.isArray(roles) ? roles : [roles];

    let whereClause = {};

    // Admin can see filtered users
    if (userRole === "ADMIN") {
      whereClause = {
        role: {
          in: roleFilters,
        },
      };
    }
    // Manager can only see their employees and themselves
    else if (userRole === "MANAGER") {
      whereClause = {
        role: "EMPLOYEE",
        managerId: userId,
      };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        city: true,
        address: true,
        profileImage: true,
        occupation: true,
        gender: true,
        createdAt: true,
        manager: {
          select: {
            id: true,
            username: true,
            gender: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        employees: {
          select: {
            id: true,
            gender: true,
            username: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    res.status(200).json({
      status: "success",
      message: "Users fetched successfully",
      data: users,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch users",
    });
  }
};

export default {
  updateProfile,
  getProfile,
  getAllUsers,
};
