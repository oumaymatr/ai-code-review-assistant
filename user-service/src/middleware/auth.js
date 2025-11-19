/**
 * Middlewares d'authentification - User Service
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { redisClient } = require("../config/database");
const logger = require("../utils/logger");
const config = require("../config/config");

/**
 * Middleware d'authentification JWT
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Access token required",
        message: "Please provide a valid access token",
      });
    }

    // 1. Vérifier si le token est blacklisté
    const isBlacklisted = await redisClient.get(`blacklisted_token:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: "Token revoked",
        message: "This token has been revoked",
      });
    }

    // 2. Vérifier et décoder le token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "Token expired",
          message: "Your session has expired. Please log in again.",
          code: "TOKEN_EXPIRED",
        });
      } else if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          error: "Invalid token",
          message: "The provided token is invalid",
        });
      } else {
        throw error;
      }
    }

    // 3. Récupérer l'utilisateur
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User not found",
        message: "The user associated with this token no longer exists",
      });
    }

    // 4. Vérifier que le compte est actif
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: "Account disabled",
        message: "Your account has been disabled",
      });
    }

    // 5. Vérifier si le mot de passe a été changé après la création du token
    if (
      user.password_changed_at &&
      decoded.iat < Math.floor(user.password_changed_at.getTime() / 1000)
    ) {
      return res.status(401).json({
        success: false,
        error: "Password changed",
        message: "Your password was changed. Please log in again.",
        code: "PASSWORD_CHANGED",
      });
    }

    // 6. Ajouter les informations utilisateur à la requête
    req.user = user;
    req.token = token;
    req.tokenData = decoded;

    next();
  } catch (error) {
    logger.error("Authentication middleware error", {
      error: error.message,
      stack: error.stack,
      token: req.headers.authorization?.substring(0, 20) + "...",
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Authentication failed",
      message: "An unexpected error occurred during authentication",
    });
  }
};

/**
 * Middleware optionnel d'authentification
 * Ajoute les infos utilisateur si un token valide est fourni, mais ne bloque pas si absent
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    if (!token) {
      return next();
    }

    // Utiliser le même processus que authenticateToken mais sans bloquer
    try {
      const isBlacklisted = await redisClient.get(`blacklisted_token:${token}`);
      if (isBlacklisted) {
        return next();
      }

      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.userId);

      if (user && user.is_active) {
        // Vérifier le changement de mot de passe
        if (
          !user.password_changed_at ||
          decoded.iat >= Math.floor(user.password_changed_at.getTime() / 1000)
        ) {
          req.user = user;
          req.token = token;
          req.tokenData = decoded;
        }
      }
    } catch (error) {
      // Ignorer les erreurs et continuer sans authentification
    }

    next();
  } catch (error) {
    logger.error("Optional auth middleware error", {
      error: error.message,
      ip: req.ip,
    });

    // En cas d'erreur, continuer sans authentification
    next();
  }
};

/**
 * Middleware de vérification des rôles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        message: "Please log in to access this resource",
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warning("Unauthorized access attempt", {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
        message: "You do not have permission to access this resource",
      });
    }

    next();
  };
};

/**
 * Middleware de limitation du taux de requêtes
 */
const rateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // 100 requêtes par fenêtre
    keyGenerator = (req) => {
      // Utiliser l'ID utilisateur si authentifié, sinon l'IP
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    },
    message = "Too many requests, please try again later",
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return async (req, res, next) => {
    try {
      const key = `ratelimit:${keyGenerator(req)}`;
      const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
      const redisKey = `${key}:${windowStart}`;

      // Obtenir le nombre de requêtes actuelles
      let requests = await redisClient.get(redisKey);
      requests = requests ? parseInt(requests) : 0;

      // Vérifier la limite
      if (requests >= max) {
        return res.status(429).json({
          success: false,
          error: "Rate limit exceeded",
          message,
          retryAfter: Math.ceil((windowStart + windowMs - Date.now()) / 1000),
        });
      }

      // Continuer avec la requête
      req.rateLimit = {
        current: requests + 1,
        limit: max,
        remaining: max - requests - 1,
        resetTime: new Date(windowStart + windowMs),
      };

      next();

      // Incrémenter après la réponse (si on ne veut pas compter certains types de réponses)
      res.on("finish", async () => {
        const shouldSkip =
          (skipSuccessfulRequests && res.statusCode < 400) ||
          (skipFailedRequests && res.statusCode >= 400);

        if (!shouldSkip) {
          await redisClient.incr(redisKey);
          await redisClient.expire(redisKey, Math.ceil(windowMs / 1000));
        }
      });
    } catch (error) {
      logger.error("Rate limiter error", {
        error: error.message,
        ip: req.ip,
        path: req.path,
      });

      // En cas d'erreur Redis, laisser passer
      next();
    }
  };
};

/**
 * Middleware de validation des tentatives de connexion échouées
 */
const checkFailedAttempts = async (req, res, next) => {
  try {
    const { email } = req.body;
    const ip = req.ip;

    if (!email) {
      return next();
    }

    // Récupérer le nombre de tentatives échouées
    const user = await User.findByEmail(email);
    const userAttempts = user
      ? await redisClient.get(`failed_attempts:user:${user.id}`)
      : 0;
    const ipAttempts = (await redisClient.get(`failed_attempts:ip:${ip}`)) || 0;

    const maxUserAttempts = 5;
    const maxIpAttempts = 10;

    // Vérifier les limites
    if (userAttempts >= maxUserAttempts) {
      return res.status(429).json({
        success: false,
        error: "Account temporarily locked",
        message:
          "Too many failed login attempts. Please try again in 15 minutes.",
        code: "ACCOUNT_LOCKED",
      });
    }

    if (ipAttempts >= maxIpAttempts) {
      return res.status(429).json({
        success: false,
        error: "IP temporarily blocked",
        message:
          "Too many failed login attempts from this IP. Please try again in 15 minutes.",
        code: "IP_BLOCKED",
      });
    }

    next();
  } catch (error) {
    logger.error("Check failed attempts error", {
      error: error.message,
      ip: req.ip,
    });

    // En cas d'erreur, laisser passer
    next();
  }
};

/**
 * Middleware de logging des requêtes sensibles
 */
const auditLog = (action) => {
  return (req, res, next) => {
    // Logger avant l'exécution
    logger.audit(`${action} attempt`, {
      userId: req.user?.id,
      email: req.user?.email,
      action,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });

    // Logger après l'exécution
    res.on("finish", () => {
      logger.audit(
        `${action} ${res.statusCode >= 400 ? "failed" : "completed"}`,
        {
          userId: req.user?.id,
          email: req.user?.email,
          action,
          statusCode: res.statusCode,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
          timestamp: new Date().toISOString(),
        }
      );
    });

    next();
  };
};

/**
 * Middleware CORS personnalisé pour le service utilisateur
 */
const corsHandler = (req, res, next) => {
  const allowedOrigins = config.cors?.allowedOrigins ||
    config.cors?.origin || ["*"];
  const origin = req.headers.origin;

  // Convert to array if it's a single value
  const originsArray = Array.isArray(allowedOrigins)
    ? allowedOrigins
    : [allowedOrigins];

  if (originsArray.includes("*") || originsArray.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }

  res.header(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin,X-Requested-With,Content-Type,Accept,Authorization"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Max-Age", "3600");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
};

/**
 * Middleware de sécurité headers
 */
const securityHeaders = (req, res, next) => {
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "DENY");
  res.header("X-XSS-Protection", "1; mode=block");
  res.header("Referrer-Policy", "strict-origin-when-cross-origin");
  res.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // CSP pour les requêtes API
  res.header(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none';"
  );

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  rateLimiter,
  checkFailedAttempts,
  auditLog,
  corsHandler,
  securityHeaders,
};
