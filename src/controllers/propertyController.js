import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Get filtered properties for PG listing
 * @route GET /properties
 * @access Public
 */
const getProperties = async (req, res) => {
  try {
    const {
      city,
      gender,
      landmark,
      minRating,
      minPrice,
      maxPrice,
      minBeds,
      status,
    } = req.query;

    // Base query
    let whereClause = {
      status: status || "available",
    };

    // Add filters
    if (city) whereClause.city = city;
    if (gender) whereClause.gender = gender;
    if (landmark) whereClause.landmarks = { has: landmark };

    const properties = await prisma.property.findMany({
      where: whereClause,
      include: {
        room_types: true,
        reviews: true,
        property_images: true,
      },
    });

    // Post-query filtering
    let filteredProperties = properties.filter((property) => {
      // Price filter
      const hasValidPrice = property.room_types.some(
        (room) =>
          (!minPrice || room.price >= minPrice) &&
          (!maxPrice || room.price <= maxPrice)
      );

      // Available beds filter
      const totalAvailableBeds = property.room_types.reduce(
        (sum, room) => sum + room.available_beds,
        0
      );

      // Rating filter
      const avgRating =
        property.reviews.length > 0
          ? property.reviews.reduce((sum, review) => sum + review.rating, 0) /
            property.reviews.length
          : 0;

      return (
        hasValidPrice &&
        (!minBeds || totalAvailableBeds >= minBeds) &&
        (!minRating || avgRating >= minRating)
      );
    });

    res.status(200).json({
      status: "success",
      message: "Properties fetched successfully",
      results: filteredProperties.length,
      data: filteredProperties,
    });
  } catch (error) {
    console.error("Property listing error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch properties",
      error: error.message,
    });
  }
};

/**
 * @desc Get info of a property
 * @route GET /properties/:id
 * @access Public
 */
const getPropertyInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id: Number(id) },
      include: {
        room_types: true,
        property_images: true,
        reviews: true,
      },
    });

    if (!property) {
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Property info fetched successfully",
      data: property,
    });
  } catch (error) {
    console.error("Property info error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch property info",
      error: error.message,
    });
  }
};

/**
 * @desc Get properties for admin panel
 * @route GET /admin
 * @access Private (Admin/Manager/Property Owner)
 */
const getAdminProperties = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role.role_name;

    let whereClause = {};

    // Filter based on user role
    if (userRole === "property_manager") {
      whereClause.manager_id = Number(userId);
    } else if (userRole === "property_owner") {
      whereClause.property_owner_id = Number(userId);
    }

    // Admin can see all properties (no where clause)

    const properties = await prisma.property.findMany({
      where: whereClause,
      include: {
        room_types: true,
        property_images: true,
        property_owner: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        manager: {
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
      message: "Properties fetched successfully",
      results: properties.length,
      data: properties,
    });
  } catch (error) {
    console.error("Admin property listing error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch properties",
      error: error.message,
    });
  }
};

/**
 * @desc Create new property request
 * @route POST /request
 * @access Private (admin/manager/user/property_owner)
 */
const createPropertyRequest = async (req, res) => {
  try {
    const wannabe_property_owner = req.user;
    const {
      name,
      address,
      city,
      gender,
      description,
      landmarks,
      amenities,
      roomTypes,
      propertyImages,
    } = req.body;

    // Validate at least one room type
    if (!roomTypes || roomTypes.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "At least one room type is required",
      });
    }

    const propertyRequest = await prisma.property.create({
      data: {
        name,
        address,
        city,
        gender,
        description,
        landmarks,
        amenities,
        status: "pending_approval",
        wannabe_property_owner: wannabe_property_owner,
        // property_owner_id: Number(propertyOwnerId),
        room_types: {
          create: roomTypes.map((room) => ({
            name: room.name,
            price: room.price,
            total_beds: room.total_beds,
            available_beds: room.total_beds, // Initially all beds are available
            occupancy_gender: room.occupancy_gender,
            description: room.description || "",
            amenities: room.amenities || [],
          })),
        },

        property_images: {
          create: propertyImages?.map((image) => ({
            image_url: image.url,
            title: image.title || "",
            description: image.description || "",
            tags: image.tags || "all",
          })),
        },
      },
      include: {
        room_types: true,
        property_images: true,
      },
    });

    res.status(201).json({
      status: "success",
      message: "Property request created successfully",
      data: propertyRequest,
    });
  } catch (error) {
    console.error("Property request creation error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create property request",
      error: error.message,
    });
  }
};

/**
 * @desc Get pending property requests
 * @route GET /admin/requests
 * @access Private (Admin/Manager)
 */
const getPendingRequests = async (req, res) => {
  try {
    console.log("req.user", req.user);
    const userRoleId = req.user.role_id;
    const userCity = req.user.city; // Assuming manager has city in their profile

    let whereClause = {
      status: "pending_approval",
    };

    // Managers can only see requests from their city
    if (userRoleId === 3) {
      whereClause.city = String(userCity);
    }

    const pendingRequests = await prisma.property.findMany({
      where: whereClause,
      include: {
        property_owner: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        room_types: true,
        property_images: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json({
      status: "success",
      message: "Pending requests fetched successfully",
      results: pendingRequests.length,
      data: pendingRequests,
    });
  } catch (error) {
    console.error("Pending requests fetch error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch pending requests",
      error: error.message,
    });
  }
};

/**
 * @desc Update property request status
 * @route PATCH /admin/requests/:id
 * @access Private (Admin)
 */

const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, manager_id } = req.body;

    if (!["under_maintenance", "rejected"].includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid status. Must be either 'available' or 'rejected'",
      });
    }

    // Validate manager_id is provided when status is "under_maintenance"
    if (status === "under_maintenance" && !manager_id) {
      return res.status(400).json({
        status: "error",
        message: "Manager ID is required when setting status to available",
      });
    }

    const updatedProperty = await prisma.property.update({
      where: { id: Number(id) },
      data: {
        status,
        manager_id: status === "under_maintenance" ? manager_id : null,
      },
      include: {
        property_owner: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        manager: {
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
      message: `Property request ${status}`,
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Request status update error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update request status",
      error: error.message,
    });
  }
};

/**
 * @desc Update property details
 * @route PATCH /properties/:id
 * @access Private (Admin/Manager/Property Owner)
 */
const updatePropertyDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role.role_name;

    // Verify whether property exists
    const property = await prisma.property.findUnique({
      where: { id: Number(id) },
      select: {
        property_owner_id: true,
        manager_id: true,
      },
    });

    if (!property) {
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }
    // Check permissions
    const hasPermission =
      userRole === "root" ||
      (userRole === "property_manager" && property.manager_id === userId) ||
      (userRole === "property_owner" && property.property_owner_id === userId);

    if (!hasPermission) {
      return res.status(403).json({
        status: "error",
        message: "You don't have permission to update this property",
      });
    }

    // Filter updateable fields based on role
    const {
      name,
      address,
      city,
      gender,
      description,
      landmarks,
      amenities,
      status,
      manager_id,
      property_owner_id,
    } = req.body;

    let updateData = {};

    // Admin can update everything
    if (userRole === "root") {
      updateData = {
        name,
        address,
        city,
        gender,
        description,
        landmarks,
        amenities,
        status,
        manager_id,
        property_owner_id,
      };
    }
    // Manager can update most fields except ownership
    else if (userRole === "property_manager") {
      updateData = {
        name,
        address,
        city,
        gender,
        description,
        landmarks,
        amenities,
        status,
        property_owner_id,
      };
    }
    // Property owner can update limited fields
    else {
      updateData = {
        description,
        landmarks,
        amenities,
        status: status === "under_maintenance" ? status : undefined,
      };
    }

    // Remove undefined values
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );
    if (updateData.property_owner_id !== null) {
      updateData.wannabe_property_owner = null;
    }
    const updatedProperty = await prisma.property.update({
      where: { id: Number(id) },
      data: updateData,

      include: {
        room_types: true,
        property_images: true,
        property_owner: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        manager: {
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
      message: "Property updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Property update error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update property",
      error: error.message,
    });
  }
};

/**
 * @desc Add or update room type
 * @route POST /properties/:id/rooms
 * @access Private (Admin/Manager)
 */
const updateRoomType = async (req, res) => {
  try {
    const { id } = req.params;
    const { room_type_id, ...roomData } = req.body;

    // Verify user has permission (admin or manager only)
    const property = await prisma.property.findUnique({
      where: { id: Number(id) },
      select: {
        manager_id: true,
      },
    });

    if (!property) {
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }

    let updatedRoom;
    if (room_type_id) {
      // Update existing room type
      updatedRoom = await prisma.roomType.update({
        where: { id: room_type_id },
        data: roomData,
      });
    } else {
      // Create new room type
      updatedRoom = await prisma.roomType.create({
        data: {
          ...roomData,
          property_id: id,
          available_beds: roomData.total_beds, // Initially all beds are available
        },
      });
    }

    res.status(200).json({
      status: "success",
      message: room_type_id ? "Room type updated" : "Room type added",
      data: updatedRoom,
    });
  } catch (error) {
    console.error("Room type update error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update room type",
      error: error.message,
    });
  }
};

/**
 * @desc Update room availability
 * @route PATCH /properties/:id/rooms/:roomId/availability
 * @access Private (Admin/Manager/Property Owner)
 */
const updateRoomAvailability = async (req, res) => {
  try {
    const { id, roomId } = req.params;
    const { available_beds } = req.body;

    const room = await prisma.roomType.findFirst({
      where: {
        id: roomId,
        property_id: id,
      },
    });

    if (!room) {
      return res.status(404).json({
        status: "error",
        message: "Room not found",
      });
    }

    if (available_beds > room.total_beds) {
      return res.status(400).json({
        status: "error",
        message: "Available beds cannot exceed total beds",
      });
    }

    const updatedRoom = await prisma.roomType.update({
      where: { id: roomId },
      data: { available_beds },
    });

    // Update property status if all rooms are occupied or if beds become available
    const allRooms = await prisma.roomType.findMany({
      where: { property_id: id },
    });

    const totalAvailableBeds = allRooms.reduce(
      (sum, room) => sum + room.available_beds,
      0
    );

    await prisma.property.update({
      where: { id },
      data: {
        status: totalAvailableBeds === 0 ? "occupied" : "available",
      },
    });

    res.status(200).json({
      status: "success",
      message: "Room availability updated",
      data: updatedRoom,
    });
  } catch (error) {
    console.error("Room availability update error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update room availability",
      error: error.message,
    });
  }
};

export default {
  getProperties,
  getPropertyInfo,
  getAdminProperties,
  createPropertyRequest,
  getPendingRequests,
  updateRequestStatus,
  updatePropertyDetails,
  updateRoomType,
  updateRoomAvailability,
};
