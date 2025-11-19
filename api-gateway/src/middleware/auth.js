/**
 * Middleware d'authentification JWT
 */

const jwt = require("jsonwebtoken");
const redis = require("redis");
const config = require("../config/config");
const logger = require("../utils/logger");

// Connection Redis pour cache des tokens
let redisClient;
const initRedis = async () => {
  try {
    redisClient = redis.createClient({ url: config.redis.url });
    await redisClient.connect();
    logger.info("Redis connected for auth middleware");
  } catch (error) {
    logger.error("Redis connection failed for auth middleware", {
      error: error.message,
    });
  }
};

initRedis();

/**
 * Vérification du token JWT
 */
const verifyToken = async (req, res, next) => {
  try {
    const startTime = Date.now();

    // Extraire le token de l'header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.auth("Missing or invalid authorization header", {
        requestId: req.id,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      return res.status(401).json({
        success: false,
        error: "Access denied",
        message: "No token provided or invalid format",
        code: "NO_TOKEN",
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Vérifier si le token est en blacklist (logout, etc.)
    if (redisClient && redisClient.isReady) {
      const isBlacklisted = await redisClient.get(
        `${config.redis.prefix}blacklist:${token}`
      );
      if (isBlacklisted) {
        logger.auth("Blacklisted token used", {
          requestId: req.id,
          ip: req.ip,
        });

        return res.status(401).json({
          success: false,
          error: "Token invalid",
          message: "Token has been revoked",
          code: "TOKEN_REVOKED",
        });
      }
    }

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Ajouter les informations utilisateur à la requête
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      role: decoded.role || "user",
      iat: decoded.iat,
      exp: decoded.exp,
    };

    req.token = token;

    // Vérifier l'expiration (sécurité supplémentaire)
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp < currentTime) {
      logger.auth("Expired token used", {
        requestId: req.id,
        userId: decoded.userId,
        exp: decoded.exp,
        currentTime,
      });

      return res.status(401).json({
        success: false,
        error: "Token expired",
        message: "Please login again",
        code: "TOKEN_EXPIRED",
      });
    }

    // Cache des informations utilisateur pour performance
    if (redisClient && redisClient.isReady) {
      const userCacheKey = `${config.redis.prefix}user:${decoded.userId}`;
      await redisClient.setEx(
        userCacheKey,
        config.redis.ttl.cache,
        JSON.stringify(req.user)
      );
    }

    // Log successful auth
    const duration = Date.now() - startTime;
    logger.auth("Token verified successfully", {
      requestId: req.id,
      userId: decoded.userId,
      email: decoded.email,
      duration: `${duration}ms`,
    });

    next();
  } catch (error) {
    logger.auth("Token verification failed", {
      requestId: req.id,
      error: error.message,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Différents types d'erreurs JWT
    let errorResponse = {
      success: false,
      error: "Authentication failed",
    };

    if (error.name === "TokenExpiredError") {
      errorResponse.message = "Token has expired";
      errorResponse.code = "TOKEN_EXPIRED";
    } else if (error.name === "JsonWebTokenError") {
      errorResponse.message = "Invalid token";
      errorResponse.code = "INVALID_TOKEN";
    } else if (error.name === "NotBeforeError") {
      errorResponse.message = "Token not active yet";
      errorResponse.code = "TOKEN_NOT_ACTIVE";
    } else {
      errorResponse.message = "Authentication error";
      errorResponse.code = "AUTH_ERROR";
    }

    return res.status(401).json(errorResponse);
  }
};

/**
 * Middleware pour vérifier les rôles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        message: "Please authenticate first",
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.security("Insufficient permissions", {
        requestId: req.id,
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl,
      });

      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
        message: `Required role(s): ${roles.join(", ")}`,
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    next();
  };
};

/**
 * Middleware optionnel pour extraire l'utilisateur s'il y a un token
 */
const extractUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
    }
  } catch (error) {
    // Ignore les erreurs, c'est optionnel
  }
  next();
};

/**
 * Générer un nouveau token JWT
 */
const generateToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: "ai-code-review-assistant",
    audience: "api-users",
  });
};

/**
 * Générer un refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: "ai-code-review-assistant",
    audience: "api-refresh",
  });
};

/**
 * Blacklist un token (pour logout)
 */
const blacklistToken = async (token) => {
  if (redisClient && redisClient.isReady) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redisClient.setEx(
            `${config.redis.prefix}blacklist:${token}`,
            ttl,
            "true"
          );
          logger.auth("Token blacklisted successfully");
        }
      }
    } catch (error) {
      logger.error("Failed to blacklist token", { error: error.message });
    }
  }
};

module.exports = {
  verifyToken,
  requireRole,
  extractUser,
  generateToken,
  generateRefreshToken,
  blacklistToken,
};
