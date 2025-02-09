import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Create new booking
 * @route POST /properties/:propertyId/rooms/:roomId/book/:userId
 * @access Private (Manager/Admin)
 */

const createBooking = async (req, res) => {
  try {
    const { propertyId, roomId, guestId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role.role_name;

    const {
      booking_date,
      check_in_date,
      check_out_date,
      rent_amount,
      security_deposit,

      payment_status,
    } = req.body;

    //check if property exists
    const property = await prisma.property.findUnique({
      where: { id: Number(propertyId) },
    });
    if (!property) {
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }
    // get managerid of the property and check it is's the correct manager who can book, cause only manager can book
    const managerId = property.manager_id;
    if (managerId !== userId || userRole !== "root") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized to book this property",
      });
    }

    // Start a transaction
    const booking = await prisma.$transaction(async (prisma) => {
      // Verify room availability
      const room = await prisma.roomType.findFirst({
        where: {
          id: Number(roomId),
          property_id: Number(propertyId),
          available_beds: {
            gt: 0,
          },
        },
        include: {
          property: true,
        },
      });

      if (!room) {
        throw new Error("Room not available for booking");
      }

      // Create booking
      const newBooking = await prisma.booking.create({
        data: {
          property_id: Number(propertyId),
          room_type_id: Number(roomId),
          user_id: Number(guestId),
          booking_date: booking_date,
          check_in_date: check_in_date,
          check_out_date: check_out_date,
          rent_amount: rent_amount,
          security_deposit: security_deposit,
          payment_status: payment_status,
          status: "pending_approval",
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
          room_type: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              phone_number: true,
              gender: true,
            },
          },
        },
      });

      // Update available beds
      await prisma.roomType.update({
        where: { id: Number(roomId) },
        data: {
          available_beds: {
            decrement: 1,
          },
        },
      });

      return newBooking;
    });

    res.status(201).json({
      status: "success",
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Booking creation error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create booking",
      error: error.message,
    });
  }
};

/**
 * @desc Get bookings list
 * @route GET /bookings
 * @access Private
 */
const getBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role.role_name;
    const { status } = req.query;

    let whereClause = {};

    // Filter based on user role
    switch (userRole) {
      case "root":
        // Admin can see all bookings
        break;
      case "manager":
        // Manager can see bookings for their properties
        whereClause = {
          property: {
            manager_id: userId,
          },
        };
        break;
      case "property_owner":
        // Property owner can see bookings for their properties
        whereClause = {
          property: {
            property_owner_id: userId,
          },
        };
        break;
      default:
        // Regular users can see their own bookings
        whereClause = {
          user_id: userId,
        };
    }

    // Add status filter if provided
    if (status) {
      whereClause.status = status;
    }

    const [bookings, total] = await prisma.$transaction([
      prisma.booking.findMany({
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
          room_type: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              phone_number: true,
              gender: true,
            },
          },
          payments: true,
        },
        orderBy: {
          created_at: "desc",
        },
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    res.status(200).json({
      status: "success",
      message: "Bookings fetched successfully",
      data: {
        bookings,
        total_bookings: total,
      },
    });
  } catch (error) {
    console.error("Bookings fetch error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};

/**
 * @desc Update booking status
 * @route PATCH /bookings/:id/status
 * @access Private (Manager/Admin)
 */
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userRole = req.user.role.role_name;

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: Number(id) },
      include: {
        property: {
          select: {
            manager_id: true,
          },
        },
        room_type: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    // Verify permission
    if (userRole !== "root" && booking.property.manager_id !== req.user.id) {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized to update this booking",
      });
    }

    // Handle status change
    const updatedBooking = await prisma.$transaction(async (prisma) => {
      const updated = await prisma.booking.update({
        where: { id: Number(id) },
        data: {
          status,
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
            room_type: true,
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                phone_number: true,
                gender: true,
              },
            },
          },
        },
      });

      // If booking is cancelled, increment available beds
      if (status === "expired") {
        await prisma.roomType.update({
          where: { id: booking.room_type_id },
          data: {
            available_beds: {
              increment: 1,
            },
          },
        });
      }

      return updated;
    });

    res.status(200).json({
      status: "success",
      message: "Booking status updated successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("Booking status update error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update booking status",
      error: error.message,
    });
  }
};

export default {
  createBooking,
  getBookings,
  updateBookingStatus,
};
