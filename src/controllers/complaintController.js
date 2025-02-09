import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Create new complaint
 * @route POST /complaints
 * @access Private (User/Property Owner)
 */
const createComplaint = async (req, res) => {
  try {
    const userId = req.user.id;
    const { property_id, title, description, category, priority } = req.body;

    // Verify user is associated with the property (current tenant)
    const userProperty = await prisma.booking.findFirst({
      where: {
        user_id: userId,
        property_id,
        status: "active",
      },
    });

    if (!userProperty) {
      return res.status(403).json({
        status: "error",
        message:
          "You can only raise complaints for properties you're currently staying in",
      });
    }

    const complaint = await prisma.complaint.create({
      data: {
        property_id,
        user_id: userId,
        title,
        description,
        category,
        priority,
        status: "active",
      },
      include: {
        property: {
          select: {
            name: true,
            address: true,
            manager: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      status: "success",
      message: "Complaint created successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Complaint creation error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create complaint",
      error: error.message,
    });
  }
};

/**
 * @desc Get complaints list
 * @route GET /complaints
 * @access Private
 */
const getComplaints = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role.role_name;

    let whereClause = {};

    // Filter based on user role
    switch (userRole) {
      case "root":
        // Admin can see all complaints
        break;
      case "manager":
        // Manager can see complaints for their properties
        whereClause = {
          property: {
            manager_id: userId,
          },
        };
        break;
      case "property_owner":
        // Property owner can see complaints for their properties
        whereClause = {
          property: {
            property_owner_id: userId,
          },
        };
        break;
      default:
        // Regular users can see their own complaints
        whereClause = {
          user_id: userId,
        };
    }

    const complaints = await prisma.complaint.findMany({
      where: whereClause,
      include: {
        property: {
          select: {
            name: true,
            address: true,
            manager: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        resolution: true,
      },

      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json({
      status: "success",
      message: "Complaints fetched successfully",
      results: complaints.length,
      data: complaints,
    });
  } catch (error) {
    console.error("Complaints fetch error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch complaints",
      error: error.message,
    });
  }
};

/**
 * @desc Update complaint status and assignment
 * @route PATCH /complaints/:id
 * @access Private (Manager/Admin)
 */
const updateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            manager_id: true,
          },
        },
      },
    });

    if (!complaint) {
      return res.status(404).json({
        status: "error",
        message: "Complaint not found",
      });
    }

    // Only manager of the property can update complaint
    if (
      complaint.property.manager_id !== req.user.id &&
      req.user.role.role_name !== "root"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You don't have permission to update this complaint",
      });
    }

    const updatedComplaint = await prisma.complaint.update({
      where: { id },
      data: {
        status,
        resolution,
      },
      include: {
        property: {
          select: {
            name: true,
            address: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      status: "success",
      message: "Complaint updated successfully",
      data: updatedComplaint,
    });
  } catch (error) {
    console.error("Complaint update error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update complaint",
      error: error.message,
    });
  }
};

export default {
  createComplaint,
  getComplaints,
  updateComplaint,
};
