import {
  PrismaClient,
  occupancy_type,
  property_status,
  user_role,
} from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Create a new property with rooms and images
 * @route POST /create
 * @access Private (ADMIN/PROPERTY_OWNER only)
 */
const createProperty = async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      googleMapLocation,
      landmarks,
      depositAmount,
      noticePeriod,
      noticePeriodUnit,
      availableFor,
      preferredTenants,
      operatingSince,
      electricityCharges,
      foodAvailability,
      gateClosingTime,
      amenityIds,
      houseRuleIds,
      rooms,
      images,
    } = req.body;

    if (!name || !address) {
      return res.status(400).json({
        status: "error",
        message: "Name and address are required",
      });
    }
    const totalBeds =
      rooms?.reduce(
        (sum, room) =>
          sum +
          (room.occupancyType === occupancy_type.SINGLE
            ? 1
            : room.occupancyType === occupancy_type.DOUBLE
              ? 2
              : room.occupancyType === occupancy_type.TRIPLE
                ? 3
                : room.numberOfBeds) *
            room.numberOfRooms,
        0
      ) || 0;
    const totalAvailableBeds =
      rooms?.reduce(
        (sum, room) =>
          sum +
          (room.occupancyType === occupancy_type.SINGLE
            ? 1
            : room.occupancyType === occupancy_type.DOUBLE
              ? 2
              : room.occupancyType === occupancy_type.TRIPLE
                ? 3
                : room.numberOfBeds) *
            room.numberOfAvailableRooms,
        0
      ) || 0;
    const hasAvailableRoomsGreaterThanRooms = rooms?.some(
      (room) => room.numberOfAvailableRooms > room.numberOfRooms
    );
    if (hasAvailableRoomsGreaterThanRooms) {
      console.log(
        "Number of available rooms cannot be greater than total number of rooms"
      );
      return res.status(400).json({
        status: "error",
        message:
          "Number of available rooms cannot be greater than total number of rooms",
      });
    }
    const newProperty = await prisma.$transaction(async (prisma) => {
      const property = await prisma.property.create({
        data: {
          name,
          description,
          address,
          googleMapLocation,
          landmarks,
          depositAmount,
          noticePeriod,
          noticePeriodUnit,
          availableFor,
          preferredTenants,
          operatingSince,
          electricityCharges,
          foodAvailability,
          gateClosingTime,
          ownerId: req.user.id,
          totalBeds,
          totalAvailableBeds,
          status:
            req.user.role === user_role.ADMIN
              ? property_status.UNLISTED
              : property_status.PENDING_APPROVAL,
          rooms: {
            create:
              rooms?.map((room) => ({
                occupancyType: room.occupancyType,
                numberOfBeds:
                  room.occupancyType === occupancy_type.SINGLE
                    ? 1
                    : room.occupancyType === occupancy_type.DOUBLE
                      ? 2
                      : room.occupancyType === occupancy_type.TRIPLE
                        ? 3
                        : room.numberOfBeds,
                rent: room.rent,
                roomDimension: room.roomDimension,
                numberOfRooms: room.numberOfRooms,
                numberOfAvailableRooms: room.numberOfAvailableRooms,
                roomAmenities: {
                  create:
                    room.amenityIds?.map((amenityId) => ({
                      amenityId,
                    })) || [],
                },
              })) || [],
          },

          images: {
            create:
              images?.map((image) => ({
                url: image.url,
                title: image.title,
                tag: image.tag,
                description: image.description,
              })) || [],
          },

          propertyAmenities: {
            create:
              amenityIds?.map((amenityId) => ({
                amenityId,
              })) || [],
          },

          propertyHouseRules: {
            create:
              houseRuleIds?.map((houseRuleId) => ({
                houseRuleId,
              })) || [],
          },
        },
        include: {
          rooms: {
            include: {
              roomAmenities: {
                include: {
                  amenity: true,
                },
              },
            },
          },
          images: true,
          propertyAmenities: {
            include: {
              amenity: true,
            },
          },
          propertyHouseRules: {
            include: {
              houseRule: true,
            },
          },
        },
      });

      return property;
    });

    return res.status(201).json({
      status: "success",
      message: "Property created successfully",
      data: newProperty,
    });
  } catch (error) {
    console.error("Error in createProperty:", error);
    return res.status(500).json({
      status: "error",
      message: "Error creating property",
    });
  }
};

/**
 * @desc Get all properties with filters and pagination
 * @route GET /all
 * @access Public
 */
const getAllProperties = async (req, res) => {
  try {
    const {
      // Pagination
      page = 1,
      limit = 10,

      // Filters
      search, // Search in name/description/address
      availableFor, // BOYS/GIRLS/COED
      preferredTenants, // STUDENTS/WORKING_PROFESSIONALS/ANYONE
      foodAvailability, // VEGETARIAN/NON_VEGETARIAN/BOTH/NONE
      minRent,
      maxRent,
      amenityIds, // Array of amenity IDs
      occupancyType, // SINGLE/DOUBLE/TRIPLE/OTHERS
      status = "AVAILABLE", // Default to show only available properties
    } = req.query;

    // Build filter conditions
    const where = {
      status: status,
      AND: [],
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    // Property type filters
    if (availableFor) where.availableFor = availableFor;
    if (preferredTenants) where.preferredTenants = preferredTenants;
    if (foodAvailability) where.foodAvailability = foodAvailability;

    // Rent range filter
    if (minRent || maxRent) {
      where.rooms = {
        some: {
          AND: [
            minRent ? { rent: { gte: parseFloat(minRent) } } : {},
            maxRent ? { rent: { lte: parseFloat(maxRent) } } : {},
          ],
        },
      };
    }

    // Amenities filter
    if (amenityIds) {
      where.propertyAmenities = {
        some: {
          amenityId: {
            in: Array.isArray(amenityIds) ? amenityIds : [amenityIds],
          },
        },
      };
    }

    // Occupancy type filter
    if (occupancyType) {
      where.rooms = {
        some: {
          occupancyType: occupancyType,
          ...(where.rooms?.some || {}), // Merge with existing room filters if any
        },
      };
    }

    // Get total count for pagination
    const total = await prisma.property.count({ where });

    // Get properties with pagination
    const properties = await prisma.property.findMany({
      where,
      include: {
        rooms: {
          include: {
            roomAmenities: {
              include: {
                amenity: true,
              },
            },
          },
        },
        images: true,
        propertyAmenities: {
          include: {
            amenity: true,
          },
        },
        propertyHouseRules: {
          include: {
            houseRule: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Properties fetched successfully",
      data: {
        properties,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error in getAllProperties:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching properties",
    });
  }
};

/**
 * @desc Get property by ID with all details
 * @route GET /api/properties/:id
 * @access Public
 */
const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        rooms: {
          include: {
            roomAmenities: {
              include: {
                amenity: true,
              },
            },
          },
        },
        images: true,
        propertyAmenities: {
          include: {
            amenity: true,
          },
        },
        propertyHouseRules: {
          include: {
            houseRule: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!property) {
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Property fetched successfully",
      data: property,
    });
  } catch (error) {
    console.error("Error in getPropertyById:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching property",
    });
  }
};

/**
 * @desc Update property details
 * @route PUT /api/properties/:id
 * @access Private (ADMIN only)
 */
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      address,
      googleMapLocation,
      landmarks,
      depositAmount,
      noticePeriod,
      noticePeriodUnit,
      availableFor,
      preferredTenants,
      operatingSince,
      electricityCharges,
      foodAvailability,
      gateClosingTime,
      status,
      amenityIds,
      houseRuleIds,
      rooms,
      images,
    } = req.body;

    // Check if property exists
    const existingProperty = await prisma.property.findUnique({
      where: { id },
    });

    if (!existingProperty) {
      console.log("Property not found");
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }

    // Calculate total beds if rooms are being updated
    const totalBeds =
      rooms?.reduce(
        (sum, room) =>
          sum +
          (room.occupancyType === occupancy_type.SINGLE
            ? 1
            : room.occupancyType === occupancy_type.DOUBLE
              ? 2
              : room.occupancyType === occupancy_type.TRIPLE
                ? 3
                : room.numberOfBeds) *
            room.numberOfRooms,
        0
      ) || existingProperty.totalBeds;
    const totalAvailableBeds =
      rooms?.reduce(
        (sum, room) =>
          sum +
          (room.occupancyType === occupancy_type.SINGLE
            ? 1
            : room.occupancyType === occupancy_type.DOUBLE
              ? 2
              : room.occupancyType === occupancy_type.TRIPLE
                ? 3
                : room.numberOfBeds) *
            room.numberOfAvailableRooms,
        0
      ) || existingProperty.totalAvailableBeds;

    // check if any room in rooms array has numberOfAvailableRooms greater than numberOfRooms
    const hasAvailableRoomsGreaterThanRooms = rooms?.some(
      (room) => room.numberOfAvailableRooms > room.numberOfRooms
    );
    if (hasAvailableRoomsGreaterThanRooms) {
      console.log(
        "Number of available rooms cannot be greater than total number of rooms"
      );
      return res.status(400).json({
        status: "error",
        message:
          "Number of available rooms cannot be greater than total number of rooms",
      });
    }
    // Update property with transaction
    const updatedProperty = await prisma.$transaction(async (prisma) => {
      // Delete existing relationships if new data is provided
      if (rooms) {
        await prisma.roomAmenity.deleteMany({
          where: { room: { propertyId: id } },
        });
        await prisma.room.deleteMany({
          where: { propertyId: id },
        });
      }

      if (images) {
        await prisma.propertyImage.deleteMany({
          where: { propertyId: id },
        });
      }

      if (amenityIds) {
        await prisma.propertyAmenity.deleteMany({
          where: { propertyId: id },
        });
      }

      if (houseRuleIds) {
        await prisma.propertyHouseRule.deleteMany({
          where: { propertyId: id },
        });
      }

      // Update property with new data
      return await prisma.property.update({
        where: { id },
        data: {
          name,
          description,
          address,
          googleMapLocation,
          landmarks,
          depositAmount,
          noticePeriod,
          noticePeriodUnit,
          availableFor,
          preferredTenants,
          operatingSince,
          electricityCharges,
          foodAvailability,
          gateClosingTime,
          status,
          totalBeds,
          totalAvailableBeds,
          rooms: rooms
            ? {
                create: rooms.map((room) => ({
                  occupancyType: room.occupancyType,
                  numberOfBeds:
                    room.occupancyType === "SINGLE"
                      ? 1
                      : room.occupancyType === "DOUBLE"
                        ? 2
                        : room.occupancyType === "TRIPLE"
                          ? 3
                          : room.numberOfBeds,
                  rent: room.rent,
                  roomDimension: room.roomDimension,
                  numberOfRooms: room.numberOfRooms,
                  numberOfAvailableRooms: room.numberOfAvailableRooms,
                  roomAmenities: {
                    create:
                      room.amenityIds?.map((amenityId) => ({
                        amenityId,
                      })) || [],
                  },
                })),
              }
            : undefined,
          images: images
            ? {
                create: images.map((image) => ({
                  url: image.url,
                  title: image.title,
                  tag: image.tag,
                  description: image.description,
                })),
              }
            : undefined,
          propertyAmenities: amenityIds
            ? {
                create: amenityIds.map((amenityId) => ({
                  amenityId,
                })),
              }
            : undefined,
          propertyHouseRules: houseRuleIds
            ? {
                create: houseRuleIds.map((houseRuleId) => ({
                  houseRuleId,
                })),
              }
            : undefined,
        },
        include: {
          rooms: {
            include: {
              roomAmenities: {
                include: {
                  amenity: true,
                },
              },
            },
          },
          images: true,
          propertyAmenities: {
            include: {
              amenity: true,
            },
          },
          propertyHouseRules: {
            include: {
              houseRule: true,
            },
          },
        },
      });
    });

    return res.status(200).json({
      status: "success",
      message: "Property updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Error in updateProperty:", error);
    return res.status(500).json({
      status: "error",
      message: "Error updating property",
    });
  }
};

/**
 * @desc Delete property
 * @route DELETE /api/properties/:id
 * @access Private (ADMIN only)
 */
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      console.log("Property not found");
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }

    // Delete property and all related data in a transaction
    await prisma.$transaction(async (prisma) => {
      // Delete all related data first
      await prisma.roomAmenity.deleteMany({
        where: { room: { propertyId: id } },
      });
      await prisma.room.deleteMany({
        where: { propertyId: id },
      });
      await prisma.propertyImage.deleteMany({
        where: { propertyId: id },
      });
      await prisma.propertyAmenity.deleteMany({
        where: { propertyId: id },
      });
      await prisma.propertyHouseRule.deleteMany({
        where: { propertyId: id },
      });

      // Finally delete the property
      await prisma.property.delete({
        where: { id },
      });
    });

    return res.status(200).json({
      status: "success",
      message: "Property deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteProperty:", error);
    return res.status(500).json({
      status: "error",
      message: "Error deleting property",
    });
  }
};

/**
 * @desc Update room details (available rooms, total rooms)
 * @route PATCH /api/properties/rooms/:roomId
 * @access Private (ADMIN and PROPERTY_OWNER)
 */
const updateRoomDetails = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { numberOfRooms, numberOfAvailableRooms } = req.body;

    // Validate input values
    if (numberOfRooms < 0 || numberOfAvailableRooms < 0) {
      return res.status(400).json({
        status: "error",
        message: "Room numbers cannot be negative",
      });
    }

    if (numberOfAvailableRooms > numberOfRooms) {
      return res.status(400).json({
        status: "error",
        message:
          "Number of available rooms cannot exceed total number of rooms",
      });
    }

    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        property: true,
      },
    });

    if (!existingRoom) {
      return res.status(404).json({
        status: "error",
        message: "Room not found",
      });
    }

    // Update room details in a transaction
    const updatedRoom = await prisma.$transaction(async (prisma) => {
      // Update room
      const room = await prisma.room.update({
        where: { id: roomId },
        data: {
          numberOfRooms,
          numberOfAvailableRooms,
        },
        include: {
          roomAmenities: {
            include: {
              amenity: true,
            },
          },
        },
      });

      // Recalculate property's total beds and available beds
      const allPropertyRooms = await prisma.room.findMany({
        where: { propertyId: existingRoom.property.id },
      });

      const totalBeds = allPropertyRooms.reduce(
        (sum, room) => sum + (room.numberOfBeds * room.numberOfRooms || 0),
        0
      );
      const totalAvailableBeds = allPropertyRooms.reduce(
        (sum, room) =>
          sum + (room.numberOfBeds * room.numberOfAvailableRooms || 0),
        0
      );

      // Update property with new totals
      await prisma.property.update({
        where: { id: existingRoom.property.id },
        data: {
          totalBeds,
          totalAvailableBeds,
        },
      });

      return room;
    });

    return res.status(200).json({
      status: "success",
      message: "Room details updated successfully",
      data: updatedRoom,
    });
  } catch (error) {
    console.error("Error in updateRoomDetails:", error);
    return res.status(500).json({
      status: "error",
      message: "Error updating room details",
    });
  }
};

export default {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  updateRoomDetails,
};
