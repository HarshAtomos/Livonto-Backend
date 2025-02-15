import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Get all amenities
 * @route GET /api/amenities
 * @access Public
 */
const getAllAmenities = async (req, res) => {
  try {
    const amenities = await prisma.amenity.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Amenities fetched successfully",
      data: amenities,
    });
  } catch (error) {
    console.error("Error in getAllAmenities:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching amenities",
    });
  }
};

/**
 * @desc Create new amenity
 * @route POST /api/amenities
 * @access Private (Admin only)
 */
const createAmenity = async (req, res) => {
  try {
    const { name, description, svgIcon } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "Amenity name is required",
      });
    }

    const amenity = await prisma.amenity.create({
      data: {
        name,
        description,
        svgIcon,
      },
    });

    return res.status(201).json({
      status: "success",
      message: "Amenity created successfully",
      data: amenity,
    });
  } catch (error) {
    console.error("Error in createAmenity:", error);
    return res.status(500).json({
      status: "error",
      message: "Error creating amenity",
    });
  }
};

/**
 * @desc Update amenity
 * @route PUT /api/amenities/:id
 * @access Private (Admin only)
 */
const updateAmenity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, svgIcon } = req.body;

    const existingAmenity = await prisma.amenity.findUnique({
      where: { id },
    });

    if (!existingAmenity) {
      return res.status(404).json({
        status: "error",
        message: "Amenity not found",
      });
    }

    const updatedAmenity = await prisma.amenity.update({
      where: { id },
      data: {
        name,
        description,
        svgIcon,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Amenity updated successfully",
      data: updatedAmenity,
    });
  } catch (error) {
    console.error("Error in updateAmenity:", error);
    return res.status(500).json({
      status: "error",
      message: "Error updating amenity",
    });
  }
};

/**
 * @desc Delete amenity
 * @route DELETE /api/amenities/:id
 * @access Private (Admin only)
 */
const deleteAmenity = async (req, res) => {
  try {
    const { id } = req.params;

    const existingAmenity = await prisma.amenity.findUnique({
      where: { id },
    });

    if (!existingAmenity) {
      return res.status(404).json({
        status: "error",
        message: "Amenity not found",
      });
    }

    await prisma.amenity.delete({
      where: { id },
    });

    return res.status(200).json({
      status: "success",
      message: "Amenity deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteAmenity:", error);
    return res.status(500).json({
      status: "error",
      message: "Error deleting amenity",
    });
  }
};

/**
 * @desc Get all house rules
 * @route GET /api/house-rules
 * @access Public
 */
const getAllHouseRules = async (req, res) => {
  try {
    const houseRules = await prisma.houseRule.findMany({
      orderBy: {
        rule: "asc",
      },
    });

    return res.status(200).json({
      status: "success",
      message: "House rules fetched successfully",
      data: houseRules,
    });
  } catch (error) {
    console.error("Error in getAllHouseRules:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching house rules",
    });
  }
};

/**
 * @desc Create new house rule
 * @route POST /api/house-rules
 * @access Private (Admin only)
 */
const createHouseRule = async (req, res) => {
  try {
    const { rule, description, svgIcon } = req.body;

    if (!rule) {
      return res.status(400).json({
        status: "error",
        message: "House rule is required",
      });
    }

    const houseRule = await prisma.houseRule.create({
      data: {
        rule,
        description,
        svgIcon,
      },
    });

    return res.status(201).json({
      status: "success",
      message: "House rule created successfully",
      data: houseRule,
    });
  } catch (error) {
    console.error("Error in createHouseRule:", error);
    return res.status(500).json({
      status: "error",
      message: "Error creating house rule",
    });
  }
};

/**
 * @desc Update house rule
 * @route PUT /api/house-rules/:id
 * @access Private (Admin only)
 */
const updateHouseRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { rule, description, svgIcon } = req.body;

    const existingHouseRule = await prisma.houseRule.findUnique({
      where: { id },
    });

    if (!existingHouseRule) {
      return res.status(404).json({
        status: "error",
        message: "House rule not found",
      });
    }

    const updatedHouseRule = await prisma.houseRule.update({
      where: { id },
      data: {
        rule,
        description,
        svgIcon,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "House rule updated successfully",
      data: updatedHouseRule,
    });
  } catch (error) {
    console.error("Error in updateHouseRule:", error);
    return res.status(500).json({
      status: "error",
      message: "Error updating house rule",
    });
  }
};

/**
 * @desc Delete house rule
 * @route DELETE /api/house-rules/:id
 * @access Private (Admin only)
 */
const deleteHouseRule = async (req, res) => {
  try {
    const { id } = req.params;

    const existingHouseRule = await prisma.houseRule.findUnique({
      where: { id },
    });

    if (!existingHouseRule) {
      return res.status(404).json({
        status: "error",
        message: "House rule not found",
      });
    }

    await prisma.houseRule.delete({
      where: { id },
    });

    return res.status(200).json({
      status: "success",
      message: "House rule deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteHouseRule:", error);
    return res.status(500).json({
      status: "error",
      message: "Error deleting house rule",
    });
  }
};

export default {
  getAllAmenities,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  getAllHouseRules,
  createHouseRule,
  updateHouseRule,
  deleteHouseRule,
};
