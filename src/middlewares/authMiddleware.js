import passport from "passport";

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({
        status: "error",
        message: "Forbidden - Insufficient permissions",
      });
    }
  };
};

// Universal authentication middleware that checks both JWT and Google authentication
export const isAuthenticated = (req, res, next) => {
  // First try JWT authentication
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({
        status: "error",
        message: "Internal server error",
      });
    }
    if (user) {
      req.user = user;
      return next();
    }

    // If JWT fails, try Google authentication
    passport.authenticate(
      "google",
      { session: false },
      (err, googleUser, info) => {
        if (err) {
          return res.status(500).json({
            status: "error",
            message: "Internal server error",
          });
        }

        if (!googleUser) {
          return res.status(401).json({
            status: "error",
            message: "Unauthorized - Please login",
          });
        }

        req.user = googleUser;
        next();
      }
    )(req, res, next);
  })(req, res, next);
};

// Middleware for checking JWT authentication (email login)
export const isAuthenticatedJWT = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({
        status: "error",
        message: "Internal server error",
      });
    }

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized - Please login first",
      });
    }

    req.user = user;
    next();
  })(req, res, next);
};

// Middleware for checking Google OAuth authentication
export const isAuthenticatedGoogle = (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({
        status: "error",
        message: "Internal server error",
      });
    }

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized - Please login with Google",
      });
    }

    req.user = user;
    next();
  })(req, res, next);
};
