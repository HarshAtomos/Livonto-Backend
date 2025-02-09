import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Create visit request
 * @route POST /visits
 * @access Private (User)
 */
const createVisitRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { property_id, notes } = req.body;

    // Verify property exists and is available for visits
    const property = await prisma.property.findFirst({
      where: {
        id: property_id,
        status: { in: ["available"] },
      },
    });

    if (!property) {
      return res.status(404).json({
        status: "error",
        message: "Property not found or not available for visits",
      });
    }

    const visit = await prisma.visit.create({
      data: {
        property_id,
        user_id: userId,
        notes,
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
            phone_number: true,
          },
        },
      },
    });

    res.status(201).json({
      status: "success",
      message: "Visit request created successfully",
      data: visit,
    });
  } catch (error) {
    console.error("Visit request creation error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create visit request",
      error: error.message,
    });
  }
};

/**
 * @desc Get visits list
 * @route GET /visits
 * @access Private
 */
const getVisits = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role.role_name;

    let whereClause = {};

    // Filter based on user role
    switch (userRole) {
      case "root":
        // Admin can see all visits
        break;
      case "manager":
        // Manager can see visits for their properties
        whereClause = {
          property: {
            manager_id: userId,
          },
        };
        break;
      case "employee":
        // Employee can see visits assigned to them
        whereClause = {
          employee_id: userId,
        };
        break;
      case "property_owner":
        // Property owner can see visits for their properties
        whereClause = {
          property: {
            property_owner_id: userId,
          },
        };
        break;
      default:
        // Regular users can see their own visits
        whereClause = {
          user_id: userId,
        };
    }

    const visits = await prisma.visit.findMany({
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
            phone_number: true,
          },
        },
        employee: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        feedback: true,
      },
      orderBy: {
        preferred_date: "desc",
      },
    });

    res.status(200).json({
      status: "success",
      message: "Visits fetched successfully",
      results: visits.length,
      data: visits,
    });
  } catch (error) {
    console.error("Visits fetch error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch visits",
      error: error.message,
    });
  }
};

/**
 * @desc Update visit details (assign employee, update status)
 * @route PATCH /visits/:id
 * @access Private (Manager/Employee/Admin)
 */
const updateVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role.role_name;
    const { status, employee_id, scheduled_date, scheduled_time } = req.body;

    // Verify visit exists
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            manager_id: true,
          },
        },
      },
    });

    if (!visit) {
      return res.status(404).json({
        status: "error",
        message: "Visit not found",
      });
    }

    // Validate permissions and allowed updates
    let updateData = {};

    if (userRole === "manager") {
      // Managers can update all fields
      updateData = {
        status,
        employee_id,
        scheduled_date,
        scheduled_time,
      };
    } else if (userRole === "employee" && visit.employee_id === req.user.id) {
      // Employees can only update status
      if (["completed", "cancelled"].includes(status)) {
        updateData = {
          status: status,
        };
      } else {
        return res.status(403).json({
          status: "error",
          message: "Invalid status",
        });
      }
    } else {
      return res.status(403).json({
        status: "error",
        message: "You don't have permission to update this visit",
      });
    }

    // Remove undefined values
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    const updatedVisit = await prisma.visit.update({
      where: { id },
      data: updateData,
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
        employee: {
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
      message: "Visit updated successfully",
      data: updatedVisit,
    });
  } catch (error) {
    console.error("Visit update error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update visit",
      error: error.message,
    });
  }
};

/**
 * @desc Add visit feedback
 * @route POST /visits/:id/feedback
 * @access Private
 */
const addVisitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { rating, comment } = req.body;

    // Verify visit exists and belongs to user
    const visit = await prisma.visit.findFirst({
      where: {
        id,
        user_id: userId,
        status: { in: ["completed", "cancelled"] },
      },
    });

    if (!visit) {
      return res.status(404).json({
        status: "error",
        message: "Visit not found or not eligible for feedback",
      });
    }

    const feedback = await prisma.visitFeedback.create({
      data: {
        visit_id: id,
        user_id: userId,
        rating,
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role_id: true,
            role: {
              select: {
                role_name: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      status: "success",
      message: "Feedback added successfully",
      data: feedback,
    });
  } catch (error) {
    console.error("Visit feedback error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to add feedback",
      error: error.message,
    });
  }
};

export default {
  createVisitRequest,
  getVisits,
  updateVisit,
  addVisitFeedback,
};
