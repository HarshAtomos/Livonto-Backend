import {
  PrismaClient,
  booking_status,
  user_role,
  visit_status,
} from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Create a new booking
 * @route POST /bookings
 * @access Private
 */
const createBooking = async (req, res) => {
  try {
    const { visitId, rooms } = req.body;
    const { role, id: userId } = req.user;

    // Validate visit
    const visit = await prisma.visit.findFirst({
      where: {
        id: visitId,
        ...(role !== user_role.ADMIN && {
          // OR: [
          //   { userId: userId },
          //   ...(role === user_role.MANAGER ? [{ managerId: userId }] : []),
          //   ...(role === user_role.EMPLOYEE ? [{ employeeId: userId }] : []),
          // ],
          userId: userId,
        }),
      },
      include: {
        property: true,
        booking: true,
        user: true,
        employee: true,
        manager: true,
      },
    });

    // Visit validations
    if (!visit) {
      console.log("Visit not found");
      return res.status(404).json({
        status: "error",
        message: "Visit not found",
      });
    }

    if (visit.status !== visit_status.COMPLETED) {
      console.log("Visit not completed");
      return res.status(400).json({
        status: "error",
        message: "Cannot book without completing visit",
      });
    }

    if (visit.booking) {
      console.log("Booking already exists for this visit");
      return res.status(400).json({
        status: "error",
        message: "Booking already exists for this visit",
      });
    }

    // Check if visit is within 7 days
    const visitCompletionDate = new Date(visit.updatedAt);
    const daysSinceVisit =
      (new Date() - visitCompletionDate) / (1000 * 60 * 60 * 24);

    if (daysSinceVisit > 7) {
      console.log("Visit has expired");
      return res.status(400).json({
        status: "error",
        message:
          "Visit has expired. Booking must be done within 7 days of visit",
      });
    }

    // Validate and check room availability
    const roomAvailability = await Promise.all(
      rooms.map(async (room) => {
        const dbRoom = await prisma.room.findUnique({
          where: { id: room.roomId },
        });

        if (!dbRoom) {
          console.log(`Room ${room.roomId} not found`);
          throw new Error(`Room ${room.roomId} not found`);
        }

        if (dbRoom.numberOfAvailableRooms < room.quantity) {
          console.log(`Not enough rooms available for ${dbRoom.id}`);
          throw new Error(
            `Not enough rooms available for ${dbRoom.occupancyType} Occupancy (No. of beds: ${dbRoom.numberOfBeds})`
          );
        }

        return {
          ...room,
          currentAvailability: dbRoom.numberOfAvailableRooms,
          rent: dbRoom.rent,
        };
      })
    );

    // Calculate total payment amount
    const paymentAmount = roomAvailability.reduce(
      (total, room) => total + Number(room.rent) * room.quantity,
      0
    );

    // Create booking with transaction
    const booking = await prisma.$transaction(async (prisma) => {
      // Create booking
      const newBooking = await prisma.booking.create({
        data: {
          paymentAmount,
          status: booking_status.PAID,
          validity: null,
          visit: {
            connect: {
              id: visit.id,
            },
          },
          property: {
            connect: {
              id: visit.propertyId,
            },
          },
          user: {
            connect: {
              id: userId,
            },
          },
          bookingRooms: {
            create: rooms.map((room) => ({
              roomId: room.roomId,
              quantity: room.quantity,
            })),
          },
        },
        include: {
          visit: true,
          bookingRooms: {
            include: {
              room: true,
            },
          },
          property: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      // Update room availability
      await Promise.all(
        rooms.map((room) =>
          prisma.room.update({
            where: { id: room.roomId },
            data: {
              numberOfAvailableRooms: {
                decrement: room.quantity,
              },
            },
          })
        )
      );

      return newBooking;
    });

    console.log("Booking created successfully");
    return res.status(201).json({
      status: "success",
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error in createBooking:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Error creating booking",
    });
  }
};

/**
 * @desc Get a booking
 * @route GET /booking
 * @access Private
 */
const getAllBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        property: {
          managerId:
            req.user.role == user_role.MANAGER ? req.user.id : undefined,
        },
      },
      include: {
        visit: true,
        bookingRooms: {
          include: {
            room: true,
          },
        },
        property: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
    console.log("Bookings fetched successfully");
    return res.status(200).json({
      status: "success",
      message: "Bookings fetched successfully",
      data: bookings,
    });
  } catch (error) {
    console.error("Error in getAllBookings:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching bookings",
    });
  }
};

/**
 * @desc Get a booking
 * @route GET /booking/:id
 * @access Private
 */
const getABooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: {
        id,
      },
      include: {
        visit: true,
        bookingRooms: {
          include: {
            room: true,
          },
        },
        property: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }
    console.log("Booking fetched successfully");
    return res.status(200).json({
      status: "success",
      message: "Booking fetched successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error in getABooking:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching booking",
    });
  }
};

/**
 * @desc Get a booking for property_owner
 * @route GET /booking/scanner/:id
 * @access Private
 */
const getABookingForScanner = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: {
        id,
      },
      include: {
        bookingRooms: {
          include: {
            room: true,
          },
        },
        property: {
          select: {
            name: true,
            address: true,
            city: true,
            pinCode: true,
            manager: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },

        user: {
          select: {
            id: true,
            profileImage: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }
    console.log("Booking fetched successfully");
    return res.status(200).json({
      status: "success",
      message: "Booking fetched successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error in getABooking:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching booking",
    });
  }
};

/**
 * @desc Update booking status to ACTIVE
 * @route PATCH /bookings/:id/activate
 * @access Private (ADMIN/MANAGER only)
 */
const activateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;

    // Check permissions
    if (role !== user_role.ADMIN && role !== user_role.MANAGER) {
      return res.status(403).json({
        status: "error",
        message: "Only admins and managers can activate bookings",
      });
    }

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: {
        id,
        // property: {
        //   managerId: role == user_role.MANAGER ? req.user.id : undefined,
        // },
      },
      include: {
        property: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    if (booking.status !== booking_status.PAID) {
      return res.status(400).json({
        status: "error",
        message: "Only PAID bookings can be activated",
      });
    }

    // Update booking status and set validity
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: booking_status.ACTIVE,
        validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from activation
      },
      include: {
        bookingRooms: {
          include: {
            room: true,
          },
        },
        property: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Booking activated successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("Error in activateBooking:", error);
    return res.status(500).json({
      status: "error",
      message: "Error activating booking",
    });
  }
};

/**
 * @desc Cron job to check and expire bookings
 * Should run daily
 */
const checkAndExpireBookings = async () => {
  try {
    const now = new Date();

    // Find active bookings that have passed their validity
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: booking_status.ACTIVE,
        validity: {
          lt: now,
        },
      },
    });

    // Update expired bookings
    await prisma.$transaction(
      expiredBookings.map((booking) =>
        prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: booking_status.EXPIRED,
          },
        })
      )
    );

    console.log(`Successfully expired ${expiredBookings.length} bookings`);
  } catch (error) {
    console.error("Error in checkAndExpireBookings:", error);
  }
};

export default {
  createBooking,
  getAllBookings,
  getABooking,
  getABookingForScanner,
  activateBooking,
  checkAndExpireBookings,
};
