function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  try {
    const token = authHeader.substring(7);

    // Mock user for development
    req.user = {
      id: "mock-user-id",
      username: "devuser",
      email: "dev@example.com",
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = authMiddleware;
