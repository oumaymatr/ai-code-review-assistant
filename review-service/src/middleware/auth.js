const jwt = require("jsonwebtoken");
const config = require("../config");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  console.log(
    "Auth middleware - Authorization header:",
    authHeader ? "Present" : "Missing"
  );

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Auth middleware - No bearer token found");
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Authorization token required",
    });
  }

  try {
    const token = authHeader.substring(7);
    console.log("Auth middleware - Token:", token.substring(0, 20) + "...");

    // Decode and verify JWT
    const decoded = jwt.verify(
      token,
      config.jwtSecret ||
        process.env.JWT_SECRET ||
        "your-secret-key-change-in-production"
    );

    console.log("Auth middleware - Token verified, userId:", decoded.userId);

    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error("Auth middleware - JWT verification failed:", error.message);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "TOKEN_EXPIRED",
        message: "Your session has expired. Please login again.",
      });
    }

    return res.status(401).json({
      success: false,
      error: "INVALID_TOKEN",
      message: "Invalid authentication token",
    });
  }
}

module.exports = authMiddleware;
