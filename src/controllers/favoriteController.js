import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Add property to favorites
 * @route POST /properties/:propertyId/favorite
 * @access Private (User)
 */
const addToFavorites = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    // Check if already favorited
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        user_id_property_id: {
          user_id: userId,
          property_id: Number(propertyId),
        },
      },
    });

    if (existingFavorite) {
      return res.status(400).json({
        status: "error",
        message: "Property already in favorites",
      });
    }

    // Add to favorites
    const favorite = await prisma.favorite.create({
      data: {
        user_id: userId,
        property_id: Number(propertyId),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            gender: true,
            status: true,
            property_images: {
              take: 1,
              select: {
                image_url: true,
              },
            },
            room_types: {
              select: {
                price: true,
                available_beds: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      status: "success",
      message: "Added to favorites",
      data: favorite,
    });
  } catch (error) {
    console.error("Add to favorites error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to add to favorites",
      error: error.message,
    });
  }
};

/**
 * @desc Remove property from favorites
 * @route DELETE /properties/:propertyId/favorite
 * @access Private (User)
 */
const removeFromFavorites = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    await prisma.favorite.delete({
      where: {
        user_id_property_id: {
          user_id: userId,
          property_id: Number(propertyId),
        },
      },
    });

    res.status(200).json({
      status: "success",
      message: "Removed from favorites",
    });
  } catch (error) {
    console.error("Remove from favorites error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to remove from favorites",
      error: error.message,
    });
  }
};

/**
 * @desc Get user's favorite properties
 * @route GET /favorites
 * @access Private (User)
 */
const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;

    const [favorites, total] = await prisma.$transaction([
      prisma.favorite.findMany({
        where: {
          user_id: userId,
        },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              gender: true,
              status: true,
              property_images: {
                take: 1,
                select: {
                  image_url: true,
                },
              },
              room_types: {
                select: {
                  price: true,
                  available_beds: true,
                },
              },
              reviews: {
                select: {
                  rating: true,
                },
              },
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      }),

      prisma.favorite.count({
        where: {
          user_id: userId,
        },
      }),
    ]);

    res.status(200).json({
      status: "success",
      message: "Favorites fetched successfully",
      data: {
        favorites: favorites,
        total_favorites: total,
      },
    });
  } catch (error) {
    console.error("Fetch favorites error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch favorites",
      error: error.message,
    });
  }
};

export default {
  addToFavorites,
  removeFromFavorites,
  getFavorites,
};
