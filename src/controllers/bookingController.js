import { PrismaClient, booking_status, visit_status } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Create a new booking
 * @route POST /bookings
 * @access Private
 */
const createBooking = async (req, res) => {
  try {
    const { visitId, rooms } = req.body;
    const userId = req.user.id;

    // Validate visit
    const visit = await prisma.visit.findUnique({
      where: {
        id: visitId,
        userId: userId, // Ensure visit belongs to user
      },
      include: {
        property: true,
        booking: true,
      },
    });

    // Visit validations
    if (!visit) {
      return res.status(404).json({
        status: "error",
        message: "Visit not found",
      });
    }

    if (visit.status !== visit_status.COMPLETED) {
      return res.status(400).json({
        status: "error",
        message: "Cannot book without completing visit",
      });
    }

    if (visit.booking) {
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
          throw new Error(`Room ${room.roomId} not found`);
        }

        if (dbRoom.numberOfAvailableRooms < room.quantity) {
          throw new Error(`Not enough rooms available for ${dbRoom.id}`);
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
          id: `BK${Date.now()}`,
          visitId: visit.id,
          propertyId: visit.propertyId,
          userId: userId,
          paymentAmount,
          status: booking_status.PAID, // Initial status is PAID
          validity: null, // Will be set when activated
          bookingRooms: {
            create: rooms.map((room) => ({
              roomId: room.roomId,
              quantity: room.quantity,
            })),
          },
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
 * @desc Update booking status to ACTIVE
 * @route PATCH /bookings/:id/activate
 * @access Private (ADMIN/MANAGER only)
 */
const activateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;

    // Check permissions
    if (role !== "ADMIN" && role !== "MANAGER") {
      return res.status(403).json({
        status: "error",
        message: "Only admins and managers can activate bookings",
      });
    }

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { id },
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

export default { createBooking, activateBooking, checkAndExpireBookings };
