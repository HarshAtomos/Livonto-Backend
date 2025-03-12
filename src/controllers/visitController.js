import {
  PrismaClient,
  visit_status,
  user_role,
  property_status,
} from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Create a new visit request
 * @route POST /create
 * @access Private (Requires completed profile)
 */
const createVisit = async (req, res) => {
  try {
    // Check if profile is complete
    if (!req.profile.isComplete) {
      console.log("Profile not complete");
      return res.status(400).json({
        status: "error",
        message: `Please complete your profile first. Missing fields: ${req.profile.mandatoryMissingFields.join(
          ", "
        )}`,
      });
    }

    const { propertyId, additionalInfo } = req.body;

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        manager: true,
      },
    });

    if (!property) {
      console.log("Property not found");
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }

    if (property.status !== property_status.AVAILABLE) {
      console.log("Property not available");
      return res.status(404).json({
        status: "error",
        message: "Property not available",
      });
    }

    // Check for existing active visit
    const existingVisit = await prisma.visit.findFirst({
      where: {
        propertyId,
        userId: req.user.id,
        status: {
          not: visit_status.CANCELLED, // Allow if previous visit was cancelled
        },
      },
    });

    if (existingVisit) {
      console.log("Active visit already exists");
      return res.status(400).json({
        status: "error",
        message: "You already have an active visit request for this property",
      });
    }
    const additionalInfoEntry = JSON.stringify({
      feedback: additionalInfo,
      timestamp: new Date(),
      status: visit_status.PENDING_APPROVAL, // Store what status was set
    });
    // Create visit request
    const visit = await prisma.visit.create({
      data: {
        propertyId,
        userId: req.user.id,
        managerId: property.manager?.id,
        userFeedbacks:
          req.user.role === user_role.USER ? [additionalInfoEntry] : [],
        managerFeedbacks:
          req.user.role === user_role.MANAGER ? [additionalInfoEntry] : [],
        status: visit_status.PENDING_APPROVAL,
      },
      include: {
        property: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return res.status(201).json({
      status: "success",
      message: "Visit request created successfully",
      data: visit,
    });
  } catch (error) {
    console.error("Error in createVisit:", error);
    return res.status(500).json({
      status: "error",
      message: "Error creating visit request",
    });
  }
};

/**
 * @desc Get visits based on user role and relationship
 * @route GET /visits/all
 * @access Private
 */
const getVisits = async (req, res) => {
  try {
    const { role, id } = req.user;
    const { visitStatus, propertyId } = req.query;

    let where = {};

    // Filter by status if provided
    if (visitStatus) {
      where.status = visitStatus;
    }

    // Filter by propertyId if provided
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Apply role-based filters
    switch (role) {
      case user_role.ADMIN:
        break;
      case user_role.PROPERTY_OWNER:
        where.property = {
          ownerId: id,
        };
        break;
      case user_role.MANAGER:
        where.managerId = id;
        break;
      case user_role.EMPLOYEE:
        where.employeeId = id;
        break;
      default:
        where.userId = id;
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        property: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Parse feedback arrays for response
    const parsedVisit = visits.map((visit) => ({
      ...visit,
      userFeedbacks: visit.userFeedbacks?.map((f) => JSON.parse(f)) || [],
      managerFeedbacks: visit.managerFeedbacks?.map((f) => JSON.parse(f)) || [],
      employeeFeedbacks:
        visit.employeeFeedbacks?.map((f) => JSON.parse(f)) || [],
    }));
    return res.status(200).json({
      status: "success",
      message: "Visits fetched successfully",
      data: parsedVisit,
    });
  } catch (error) {
    console.error("Error in getVisits:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching visits",
    });
  }
};

/**
 * @desc Update visit status
 * @route PATCH /api/visits/:id/status
 * @access Private
 */
const updateVisitStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;
    const { role } = req.user;

    if (!feedback) {
      return res.status(400).json({
        status: "error",
        message: "Feedback is required when updating status",
      });
    }

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        property: true,
      },
    });

    if (!visit) {
      console.log("Visit not found");
      return res.status(404).json({
        status: "error",
        message: "Visit not found",
      });
    }

    // Create feedback entry with timestamp
    const feedbackEntry = JSON.stringify({
      feedback,
      timestamp: new Date(),
      status, // Store what status was set
    });

    // Determine which feedback array to update based on role
    let updateData = { status };

    if (role === user_role.ADMIN || role === user_role.MANAGER) {
      if (visit.managerId !== req.user.id) {
        return res.status(403).json({
          status: "error",
          message: "You can only update status for your own visits",
        });
      }
      if (status === visit_status.CONFIRMED) {
        return res.status(403).json({
          status: "error",
          message:
            "You cannot confirm a visit, it gets automatically confirmed while assigning employee",
        });
      }
      updateData.managerFeedbacks = {
        push: feedbackEntry,
      };
    } else if (visit.userId === req.user.id) {
      if (status !== visit_status.CANCELLED) {
        return res.status(403).json({
          status: "error",
          message: "Users can only cancel their visits",
        });
      }
      updateData.userFeedbacks = {
        push: feedbackEntry,
      };
    } else if (visit.employeeId === req.user.id) {
      if (
        ![
          visit_status.CANCELLED,
          visit_status.DELAYED,
          visit_status.COMPLETED,
        ].includes(status)
      ) {
        return res.status(403).json({
          status: "error",
          message:
            "Employees can only mark visits as cancelled, delayed, or completed",
        });
      }
      updateData.employeeFeedbacks = {
        push: feedbackEntry,
      };
    } else {
      return res.status(403).json({
        status: "error",
        message: "Not authorized to update this visit",
      });
    }

    // Update visit status and add feedback
    const updatedVisit = await prisma.visit.update({
      where: { id },
      data: updateData,
      include: {
        property: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Parse feedback arrays for response
    const parsedVisit = {
      ...updatedVisit,
      userFeedbacks:
        updatedVisit.userFeedbacks?.map((f) => JSON.parse(f)) || [],
      managerFeedbacks:
        updatedVisit.managerFeedbacks?.map((f) => JSON.parse(f)) || [],
      employeeFeedbacks:
        updatedVisit.employeeFeedbacks?.map((f) => JSON.parse(f)) || [],
    };
    console.log("Visit status updated successfully");
    return res.status(200).json({
      status: "success",
      message: "Visit status updated successfully",
      data: parsedVisit,
    });
  } catch (error) {
    console.error("Error in updateVisitStatus:", error);
    return res.status(500).json({
      status: "error",
      message: "Error updating visit status",
    });
  }
};

/**
 * @desc Assign employee to visit
 * @route PATCH /api/visits/:id/assign
 * @access Private (ADMIN/MANAGER only)
 */
const assignEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, scheduledAt } = req.body;
    const { role } = req.user;

    // Validate required fields
    if (!employeeId || !scheduledAt) {
      return res.status(400).json({
        status: "error",
        message: "Employee ID and scheduled time are required",
      });
    }

    // Validate scheduledAt is a future date
    const scheduleDate = new Date(scheduledAt);
    if (scheduleDate <= new Date()) {
      return res.status(400).json({
        status: "error",
        message: "Scheduled time must be in the future",
      });
    }

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        property: true,
      },
    });

    if (!visit) {
      console.log("Visit not found");
      return res.status(404).json({
        status: "error",
        message: "Visit not found",
      });
    }

    // If manager (not admin), check if they manage this property
    if (role === user_role.MANAGER && visit.managerId !== req.user.id) {
      return res.status(403).json({
        status: "error",
        message: "You can only assign employees to visits you manage",
      });
    }

    // Check if employee exists and validate their role and manager
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.role !== user_role.EMPLOYEE) {
      return res.status(400).json({
        status: "error",
        message: "Invalid employee selected",
      });
    }

    // If manager is assigning, ensure employee reports to them
    if (role === user_role.MANAGER && employee.managerId !== req.user.id) {
      return res.status(403).json({
        status: "error",
        message: "You can only assign employees who report to you",
      });
    }

    // Create feedback entry for employee assignment
    const feedbackEntry = JSON.stringify({
      feedback: `${employee.name || employee.username || employee.email} assigned to visit`,
      timestamp: new Date(),
      status: visit_status.CONFIRMED,
    });

    // Update visit with employee and scheduled time
    const updatedVisit = await prisma.visit.update({
      where: { id },
      data: {
        employeeId,
        scheduledAt: scheduleDate,
        status: visit_status.CONFIRMED,
        managerFeedbacks: {
          push: feedbackEntry,
        },
      },
      include: {
        property: true,
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
          },
        },
        employee: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Parse feedback arrays for response
    const parsedVisit = {
      ...updatedVisit,
      userFeedbacks: updatedVisit.userFeedbacks?.map((f) => JSON.parse(f)),
      employeeFeedbacks: updatedVisit.employeeFeedbacks?.map((f) =>
        JSON.parse(f)
      ),
      managerFeedbacks: updatedVisit.managerFeedbacks?.map((f) =>
        JSON.parse(f)
      ),
    };

    return res.status(200).json({
      status: "success",
      message: "Employee assigned successfully",
      data: parsedVisit,
    });
  } catch (error) {
    console.error("Error in assignEmployee:", error);
    return res.status(500).json({
      status: "error",
      message: "Error assigning employee",
    });
  }
};

export default { createVisit, getVisits, updateVisitStatus, assignEmployee };
