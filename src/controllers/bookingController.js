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
    const { visitId, rooms, couponCode } = req.body;
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

    // Check if coupon code is valid
    const coupon = await validateCouponCodeInternal(couponCode, userId);
    if (coupon.status === "error") {
      return res.status(400).json({
        status: "error",
        message: coupon.message,
      });
    }
    let paidAmount = paymentAmount;
    if (coupon.status === "success") {
      paidAmount = paymentAmount - Number(process.env.COUPON_DISCOUNT);
    }

    // Create booking with transaction
    const booking = await prisma.$transaction(async (prisma) => {
      // Create booking
      const newBooking = await prisma.booking.create({
        data: {
          paymentAmount,
          discountAmount:
            coupon.status === "success"
              ? Number(process.env.COUPON_DISCOUNT)
              : 0,
          paidAmount,
          status: booking_status.PENDING_CONFIRMATION,
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

      //Update visit status to BOOKED
      await prisma.visit.update({
        where: { id: visit.id },
        data: {
          status: visit_status.BOOKED,
        },
      });

      // Incerase number of referrals of the user
      if (coupon.data) {
        await prisma.user.update({
          where: { id: coupon.data.id },
          data: {
            referrals: {
              increment: 1,
            },
          },
        });
      }
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

// Separate validation logic from route handler
const validateCouponCodeInternal = async (couponCode, userId) => {
  if (!couponCode) {
    return { status: "success", message: "No coupon code provided" };
  }

  const user = await prisma.user.findFirst({
    where: {
      referralCode: couponCode,
    },
  });

  if (!user) {
    return { status: "error", message: "Not a valid coupon" };
  }

  if (user.id === userId) {
    return {
      status: "error",
      message: "You cannot use your own referral code",
    };
  }

  return {
    status: "success",
    message: "It's a valid coupon",
    data: { id: user.id, discount: Number(process.env.COUPON_DISCOUNT) },
  };
};

// Update the route handler to use the internal function
const validateCouponCode = async (req, res) => {
  const { couponCode } = req.body;
  const { id: userId } = req.user;

  const result = await validateCouponCodeInternal(couponCode, userId);
  return res.status(result.status === "success" ? 200 : 400).json(result);
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
    // const { role } = req.user;

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

    if (booking.status !== booking_status.PENDING_CONFIRMATION) {
      return res.status(400).json({
        status: "error",
        message: "Only PAID bookings can be activated",
      });
    }

    // Update booking status and set validity
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: booking_status.CONFIRMED,
        validity: new Date(
          new Date().setHours(23, 59, 59, 999) + 30 * 24 * 60 * 60 * 1000
        ), // till the end of the 30th day
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

const voucherValidity = async (req, res) => {
  const { id } = req.params;
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
  const now = new Date();
  const validity = booking.validity;
  if (validity && validity < now) {
    return res.status(200).json({
      status: "success",
      message: "Voucher is valid",
      data: "Valid till " + validity.toISOString(),
    });
  } else {
    return res.status(200).json({
      status: "error",
      message: "Voucher is expired",
    });
  }
};
/**
 * @desc Cron job to check and expire bookings
 * Should run daily
 */
// const checkAndExpireBookings = async () => {
//   try {
//     const now = new Date();

//     // Find active bookings that have passed their validity
//     const expiredBookings = await prisma.booking.findMany({
//       where: {
//         status: booking_status.ACTIVE,
//         validity: {
//           lt: now,
//         },
//       },
//     });

//     // Update expired bookings
//     await prisma.$transaction(
//       expiredBookings.map((booking) =>
//         prisma.booking.update({
//           where: { id: booking.id },
//           data: {
//             status: booking_status.EXPIRED,
//           },
//         })
//       )
//     );

//     console.log(`Successfully expired ${expiredBookings.length} bookings`);
//   } catch (error) {
//     console.error("Error in checkAndExpireBookings:", error);
//   }
// };

export default {
  createBooking,
  getAllBookings,
  validateCouponCode,
  getABooking,
  getABookingForScanner,
  activateBooking,
  voucherValidity,
  // checkAndExpireBookings,
};
