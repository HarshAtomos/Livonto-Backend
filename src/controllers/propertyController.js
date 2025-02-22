import {
  PrismaClient,
  occupancy_type,
  property_status,
  user_role,
} from "@prisma/client";
import cloudinary from "cloudinary";
const prisma = new PrismaClient();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
      latitude,
      longitude,
      depositAmount,
      noticePeriod,
      noticePeriodUnit,
      availableFor,
      preferredTenants,
      operatingSince,
      electricityCharges,
      foodAvailability,
      gateClosingTime,
      propertyAmenities,
      propertyHouseRules,
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
                : Number(room.numberOfBeds)) *
            Number(room.numberOfRooms),
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
                : Number(room.numberOfBeds)) *
            Number(room.numberOfAvailableRooms),
        0
      ) || 0;
    let hasAvailableRoomsGreaterThanRooms = false;
    rooms?.forEach((room) => {
      if (Number(room.numberOfAvailableRooms) > Number(room.numberOfRooms)) {
        hasAvailableRoomsGreaterThanRooms = true;
      }
    });
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
          latitude,
          longitude,
          depositAmount,
          noticePeriod: Number(noticePeriod),
          noticePeriodUnit,
          availableFor,
          preferredTenants,
          operatingSince,
          electricityCharges,
          foodAvailability,
          gateClosingTime,
          ownerId: req.user.id,
          managerId: req.user.role === user_role.ADMIN ? req.user.id : null,
          totalBeds,
          totalAvailableBeds,
          status:
            req.user.role === user_role.ADMIN
              ? property_status.UNLISTED
              : property_status.PENDING_APPROVAL,
          propertyAmenities,
          propertyHouseRules,
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
                        : Number(room.numberOfBeds),
                rent: Number(room.rent),
                roomDimension: room.roomDimension,
                numberOfRooms: Number(room.numberOfRooms),
                numberOfAvailableRooms: Number(room.numberOfAvailableRooms),
                roomAmenities: room.roomAmenities || [],
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
        },
        include: {
          rooms: true,
          images: true,
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
      availableFor, // BOYS/GIRLS/BOTH
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
      status: status === "ALL" ? undefined : status,
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
      where.OR = [
        {
          propertyAmenities: {
            some: {
              amenityId: {
                in: Array.isArray(amenityIds) ? amenityIds : [amenityIds],
              },
            },
          },
        },
        {
          rooms: {
            some: {
              roomAmenities: {
                some: {
                  amenityId: {
                    in: Array.isArray(amenityIds) ? amenityIds : [amenityIds],
                  },
                },
              },
            },
          },
        },
      ];
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
        rooms: true,
        images: true,
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            profileImage: true,
            city: true,
            gender: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            profileImage: true,
            city: true,
            gender: true,
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
        rooms: true,
        images: true,
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
      latitude,
      longitude,
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
      propertyAmenities,
      propertyHouseRules,
      rooms,
      images,
      ownerId,
      managerId,
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
    if (managerId) {
      // change managerId in visits table
      await prisma.visit.updateMany({
        where: { propertyId: id },
        data: { managerId },
      });
      // change managerId in property table
      await prisma.property.update({
        where: { id },
        data: { managerId },
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
        await prisma.room.deleteMany({
          where: { propertyId: id },
        });
      }

      if (images) {
        await prisma.propertyImage.deleteMany({
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
          latitude,
          longitude,
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
          ownerId,
          managerId,
          propertyAmenities,
          propertyHouseRules,
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
                  roomAmenities: room.roomAmenities || [],
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
          propertyAmenities: propertyAmenities,
          propertyHouseRules: propertyHouseRules,
        },
        include: {
          owner: true,
          manager: true,
          rooms: true,
          images: true,
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
      await prisma.room.deleteMany({
        where: { propertyId: id },
      });
      await prisma.visit.deleteMany({
        where: { propertyId: id },
      });
      await prisma.booking.deleteMany({
        where: { propertyId: id },
      });
      await prisma.review.deleteMany({
        where: { propertyId: id },
      });
      await prisma.propertyImage.deleteMany({
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
 * @desc Update room details
 * @route PATCH /api/properties/rooms/:roomId
 * @access Private (ADMIN and PROPERTY_OWNER)
 */
const updateRoomDetails = async (req, res) => {
  try {
    const { roomId } = req.params;
    const {
      numberOfRooms,
      numberOfAvailableRooms,
      // Additional fields only for admin
      occupancyType,
      numberOfBeds,
      rent,
      roomDimension,
      roomAmenities,
    } = req.body;

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

    // For property owners, only allow updating room numbers
    let updateData = {};
    if (req.user.role === user_role.ADMIN) {
      // Admin can update all fields
      updateData = {
        numberOfRooms,
        numberOfAvailableRooms,
        occupancyType,
        numberOfBeds:
          occupancyType === occupancy_type.SINGLE
            ? 1
            : occupancyType === occupancy_type.DOUBLE
              ? 2
              : occupancyType === occupancy_type.TRIPLE
                ? 3
                : numberOfBeds,
        rent,
        roomDimension,
        roomAmenities,
      };
    } else {
      // Property owners can only update room numbers
      updateData = {
        numberOfRooms,
        numberOfAvailableRooms,
      };
    }

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

    // Update room details in a transaction
    const updatedRoom = await prisma.$transaction(async (prisma) => {
      const room = await prisma.room.update({
        where: { id: roomId },
        data: updateData,
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

/**
 * @desc Update property status
 * @route PATCH /api/properties/:id/status
 * @access Private (ADMIN only)
 */
const updatePropertyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!Object.values(property_status).includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid property status",
      });
    }

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }

    // Update property status
    const updatedProperty = await prisma.property.update({
      where: { id },
      data: { status },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Property status updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Error in updatePropertyStatus:", error);
    return res.status(500).json({
      status: "error",
      message: "Error updating property status",
    });
  }
};

/**
 * @desc Delete a room
 * @route DELETE /api/properties/rooms/:roomId
 * @access Private (ADMIN only)
 */
const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

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

    // Delete room and update property totals in a transaction
    await prisma.$transaction(async (prisma) => {
      // Delete room
      await prisma.room.delete({
        where: { id: roomId },
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
    });

    return res.status(200).json({
      status: "success",
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteRoom:", error);
    return res.status(500).json({
      status: "error",
      message: "Error deleting room",
    });
  }
};

/**
 * @desc Update property image details
 * @route PATCH /api/properties/images/:imageId
 * @access Private (ADMIN and PROPERTY_OWNER)
 */
const updatePropertyImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { title, tag, description } = req.body;

    // Check if image exists
    const existingImage = await prisma.propertyImage.findUnique({
      where: { id: imageId },
      include: {
        property: true,
      },
    });

    if (!existingImage) {
      return res.status(404).json({
        status: "error",
        message: "Property image not found",
      });
    }

    // Update image details
    const updatedImage = await prisma.propertyImage.update({
      where: { id: imageId },
      data: {
        title,
        tag,
        description,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Property image details updated successfully",
      data: updatedImage,
    });
  } catch (error) {
    console.error("Error in updatePropertyImage:", error);
    return res.status(500).json({
      status: "error",
      message: "Error updating property image details",
    });
  }
};

/**
 * @desc Delete property image
 * @route DELETE /api/properties/images/:imageId
 * @access Private (ADMIN and PROPERTY_OWNER)
 */
const deletePropertyImage = async (req, res) => {
  try {
    const { imageId, publicId } = req.params;
    if (!publicId) {
      return res.status(400).json({
        status: "error",
        message: "Public ID is required",
      });
    }
    // Check if image exists
    const existingImage = await prisma.propertyImage.findUnique({
      where: { id: imageId },
      include: {
        property: true,
      },
    });

    if (!existingImage) {
      return res.status(404).json({
        status: "error",
        message: "Property image not found",
      });
    }

    await cloudinary.v2.uploader.destroy(publicId);

    // Delete from database
    await prisma.propertyImage.delete({
      where: { id: imageId },
    });

    return res.status(200).json({
      status: "success",
      message: "Property image deleted successfully",
    });
  } catch (error) {
    console.error("Error in deletePropertyImage:", error);
    return res.status(500).json({
      status: "error",
      message: "Error deleting property image",
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
  updatePropertyStatus,
  deleteRoom,
  updatePropertyImage,
  deletePropertyImage,
};
