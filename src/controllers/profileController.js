import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Update user profile
 * @route PUT /profile/update
 * @access Private
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { first_name, last_name, phone_number, address, occupation, city } =
      req.body;

    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        first_name,
        last_name,
        phone_number,
        address,
        city,
        occupation,
      },
      select: {
        id: true,
        username: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        address: true,
        occupation: true,
        city: true,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

export default {
  updateProfile,
};
