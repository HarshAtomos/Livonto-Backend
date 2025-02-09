import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Create new property review
 * @route POST /properties/:propertyId/reviews
 * @access Private (User)
 */
const createReview = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;
    const { rating, comment } = req.body;

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        status: "error",
        message: "Rating must be between 1 and 5",
      });
    }

    // Check if user has already reviewed this property
    const existingReview = await prisma.review.findFirst({
      where: {
        property_id: Number(propertyId),
        user_id: userId,
      },
    });

    if (existingReview) {
      return res.status(400).json({
        status: "error",
        message: "You have already reviewed this property",
      });
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        property_id: Number(propertyId),
        user_id: userId,
        rating,
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile_image: true,
          },
        },
      },
    });

    // Update property average rating
    const propertyReviews = await prisma.review.findMany({
      where: {
        property_id: Number(propertyId),
      },
      select: {
        rating: true,
      },
    });

    const avgRating =
      propertyReviews.reduce((sum, review) => sum + review.rating, 0) /
      propertyReviews.length;

    await prisma.property.update({
      where: {
        id: Number(propertyId),
      },
      data: {
        average_rating: avgRating,
      },
    });

    res.status(201).json({
      status: "success",
      message: "Review created successfully",
      data: review,
    });
  } catch (error) {
    console.error("Review creation error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create review",
      error: error.message,
    });
  }
};

/**
 * @desc Get property reviews
 * @route GET /properties/:propertyId/reviews
 * @access Public
 */
const getPropertyReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where: {
          property_id: Number(propertyId),
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profile_image: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      }),

      prisma.review.count({
        where: {
          property_id: Number(propertyId),
        },
      }),
    ]);

    // Calculate rating statistics
    const ratingStats = await prisma.review.groupBy({
      by: ["rating"],
      where: {
        property_id: Number(propertyId),
      },
      _count: true,
    });

    const stats = {
      total_reviews: total,
      average_rating:
        reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviews.length,
      rating_distribution: ratingStats.reduce((acc, curr) => {
        acc[curr.rating] = curr._count;
        return acc;
      }, {}),
    };

    res.status(200).json({
      status: "success",
      message: "Reviews fetched successfully",
      data: {
        reviews,

        stats,
        pagination: {
          current_page: Number(page),
          total_pages: Math.ceil(total / limit),
          total_reviews: total,
        },
      },
    });
  } catch (error) {
    console.error("Reviews fetch error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch reviews",
      error: error.message,
    });
  }
};

/**
 * @desc Update review
 * @route PATCH /reviews/:id
 * @access Private (Review Owner)
 */
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { rating, comment } = req.body;

    // Verify review exists and belongs to user
    const review = await prisma.review.findFirst({
      where: {
        id: Number(id),
        user_id: userId,
      },
    });

    if (!review) {
      return res.status(404).json({
        status: "error",
        message: "Review not found or unauthorized",
      });
    }

    // Update the review
    const updatedReview = await prisma.review.update({
      where: {
        id: Number(id),
      },
      data: {
        rating,
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile_image: true,
          },
        },
      },
    });

    // Update property average rating
    const propertyReviews = await prisma.review.findMany({
      where: {
        property_id: review.property_id,
      },
      select: {
        rating: true,
      },
    });

    const avgRating =
      propertyReviews.reduce((sum, review) => sum + review.rating, 0) /
      propertyReviews.length;

    await prisma.property.update({
      where: {
        id: review.property_id,
      },
      data: {
        average_rating: avgRating,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    console.error("Review update error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update review",
      error: error.message,
    });
  }
};

/**
 * @desc Delete review
 * @route DELETE /reviews/:id
 * @access Private (Review Owner/Admin)
 */
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role.role_name;

    // Verify review exists
    const review = await prisma.review.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!review) {
      return res.status(404).json({
        status: "error",
        message: "Review not found",
      });
    }

    // Check permission
    if (review.user_id !== userId && userRole !== "root") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized to delete this review",
      });
    }

    // Delete the review
    await prisma.review.delete({
      where: {
        id: Number(id),
      },
    });

    // Update property average rating
    const propertyReviews = await prisma.review.findMany({
      where: {
        property_id: review.property_id,
      },
      select: {
        rating: true,
      },
    });

    const avgRating =
      propertyReviews.length > 0
        ? propertyReviews.reduce((sum, review) => sum + review.rating, 0) /
          propertyReviews.length
        : 0;

    await prisma.property.update({
      where: {
        id: review.property_id,
      },
      data: {
        average_rating: avgRating,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Review deletion error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete review",
      error: error.message,
    });
  }
};

export default {
  createReview,
  getPropertyReviews,
  updateReview,
  deleteReview,
};
