export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // Admin (role 0) always has access
    if (req.user.role_id === 0) {
      return next();
    }

    // Convert single role to array for consistent handling
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (roles.includes(req.user.role_id)) {
      next();
    } else {
      res.status(403).json({ message: "Forbidden" });
    }
  };
};
