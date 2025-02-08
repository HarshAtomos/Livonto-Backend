export const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role_id === role) {
      next();
    } else {
      res.status(403).json({ message: "Forbidden" });
    }
  };
};
