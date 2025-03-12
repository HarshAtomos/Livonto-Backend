import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @desc Get all reviews or reviews for a specific property
 * @route GET /api/reviews/:propertyId?
 * @access Public
 */
const getReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Get reviews with non-null review text
    const reviews = await prisma.review.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
      },
    });

    // Calculate statistics
    const totalRatings = reviews.length;
    const avgRating =
      totalRatings > 0
        ? Number(
            (
              reviews.reduce((sum, review) => sum + review.rating, 0) /
              totalRatings
            ).toFixed(1)
          )
        : 0;

    // Calculate frequency of each rating
    const ratingFrequency = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    reviews.forEach((review) => {
      if (review.rating >= 1 && review.rating <= 5) {
        ratingFrequency[review.rating]++;
      }
    });
    const actualReviews = reviews.filter((review) => review.review !== null);
    const result = {
      reviews: actualReviews,
      stats: {
        avgRating,
        totalRatings,
        ratingFrequency,
      },
    };

    console.log("Reviews fetched successfully");
    return res.status(200).json({
      status: "success",
      message: "Reviews fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getReviews:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching reviews",
    });
  }
};
/**
 * @desc Get reviews by the current user
 * @route GET /api/reviews/user/:propertyId
 * @access Private
 */
const getUserReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { propertyId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { userId, propertyId },
    });
    console.log("User review fetched successfully");
    return res.status(200).json({
      status: "success",
      message: "User review fetched successfully",
      data: reviews,
    });
  } catch (error) {
    console.error("Error in getUserReviews:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching user reviews",
    });
  }
};
/**
 * @desc Create a new review
 * @route POST /api/reviews
 * @access Private
 */
const createReview = async (req, res) => {
  try {
    const { rating, review, propertyId } = req.body;
    const userId = req.user.id;

    // Check if the user has already reviewed this property
    const existingReview = await prisma.review.findFirst({
      where: { userId, propertyId },
    });
    if (existingReview) {
      return res.status(400).json({
        status: "error",
        message: "User has already reviewed this property",
      });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        status: "error",
        message: "Invalid rating. Rating should be between 1 and 5.",
      });
    }
    const newReview = await prisma.review.create({
      data: { userId, rating, review, propertyId },
    });
    return res.status(201).json({
      status: "success",
      message: "Review created successfully",
      data: newReview,
    });
  } catch (error) {
    console.error("Error in createReview:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Error creating review" });
  }
};

/**
 * @desc Update a review
 * @route PUT /api/reviews/:id
 * @access Private
 */
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const userId = req.user.id;

    const existingReview = await prisma.review.findUnique({
      where: { id },
    });
    if (!existingReview) {
      return res
        .status(404)
        .json({ status: "error", message: "Review not found" });
    }

    if (existingReview.userId !== userId) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized to update this review",
      });
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: { rating, review },
    });

    return res.status(200).json({
      status: "success",
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    console.error("Error in updateReview:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Error updating review" });
  }
};

/**
 * @desc Delete a review
 * @route DELETE /api/reviews/:id
 * @access Private
 */
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existingReview = await prisma.review.findUnique({
      where: { id },
    });
    if (!existingReview) {
      return res
        .status(404)
        .json({ status: "error", message: "Review not found" });
    }

    if (existingReview.userId !== userId) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized to delete this review",
      });
    }

    await prisma.review.delete({ where: { id } });

    return res
      .status(200)
      .json({ status: "success", message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error in deleteReview:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Error deleting review" });
  }
};

export default {
  getReviews,
  getUserReviews,
  createReview,
  updateReview,
  deleteReview,
};
