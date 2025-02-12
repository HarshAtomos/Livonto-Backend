export const checkProfileCompletion = async (req, res, next) => {
  try {
    const user = req.user;

    const requiredFields = [
      "email",
      "gender",
      "name",
      "phone",
      "city",
      "address",
      "profile_image",
      "occupation",
    ];

    const mandatoryFields = ["email", "phone", "name"];

    const missingFields = requiredFields.filter((field) => !user[field]);
    const mandatoryMissingFields = mandatoryFields.filter(
      (field) => !user[field]
    );
    const isComplete = mandatoryMissingFields.length === 0;

    req.profile = {
      profile: user,
      isComplete: isComplete,
      mandatoryMissingFields: mandatoryMissingFields,
      completionPercentage: Math.round(
        ((requiredFields.length - missingFields.length) /
          requiredFields.length) *
          100
      ),
    };

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "Failed to check profile completion",
    });
  }
};
