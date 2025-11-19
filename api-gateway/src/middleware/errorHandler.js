/**
 * Middleware de gestion d'erreurs global
 */

const logger = require("../utils/logger");
const config = require("../config/config");

/**
 * Middleware de gestion d'erreurs global
 */
const errorHandler = (err, req, res, next) => {
  // Si la réponse a déjà été envoyée, passer au middleware suivant
  if (res.headersSent) {
    return next(err);
  }

  // Log de l'erreur avec contexte
  logger.error("Error occurred", {
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.userId || "anonymous",
    timestamp: new Date().toISOString(),
  });

  let statusCode = 500;
  let errorResponse = {
    success: false,
    error: "Internal server error",
    message: "Something went wrong",
    requestId: req.id,
    timestamp: new Date().toISOString(),
  };

  // Gestion spécialisée selon le type d'erreur

  // Erreurs de validation
  if (err.name === "ValidationError") {
    statusCode = 400;
    errorResponse.error = "Validation error";
    errorResponse.message = err.message;
    errorResponse.details = err.details || [];
    errorResponse.code = "VALIDATION_ERROR";
  }

  // Erreurs JWT
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    errorResponse.error = "Authentication error";
    errorResponse.message = "Invalid token";
    errorResponse.code = "INVALID_TOKEN";
  }

  // Token expiré
  else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    errorResponse.error = "Authentication error";
    errorResponse.message = "Token expired";
    errorResponse.code = "TOKEN_EXPIRED";
  }

  // Erreurs de base de données
  else if (err.name === "DatabaseError" || err.code?.startsWith("23")) {
    statusCode = 500;
    errorResponse.error = "Database error";

    if (config.env === "development") {
      errorResponse.message = err.message;
    } else {
      errorResponse.message = "Database operation failed";
    }

    errorResponse.code = "DATABASE_ERROR";
  }

  // Erreurs de connexion Redis
  else if (err.code === "ECONNREFUSED" && err.address) {
    statusCode = 503;
    errorResponse.error = "Service unavailable";
    errorResponse.message = "Cache service is temporarily unavailable";
    errorResponse.code = "CACHE_UNAVAILABLE";
  }

  // Erreurs de proxy/microservices
  else if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    statusCode = 503;
    errorResponse.error = "Service unavailable";
    errorResponse.message = "Unable to connect to backend service";
    errorResponse.code = "SERVICE_UNAVAILABLE";
  }

  // Erreurs de taille de fichier
  else if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 413;
    errorResponse.error = "File too large";
    errorResponse.message = `File size exceeds limit of ${Math.round(config.upload.maxFileSize / 1024 / 1024)}MB`;
    errorResponse.code = "FILE_TOO_LARGE";
  }

  // Erreurs de type de fichier
  else if (err.code === "INVALID_FILE_TYPE") {
    statusCode = 400;
    errorResponse.error = "Invalid file type";
    errorResponse.message = `Allowed file types: ${config.upload.allowedTypes.join(", ")}`;
    errorResponse.code = "INVALID_FILE_TYPE";
  }

  // Erreur HTTP avec status code
  else if (err.status || err.statusCode) {
    statusCode = err.status || err.statusCode;
    errorResponse.error = err.name || "HTTP Error";
    errorResponse.message = err.message || "HTTP error occurred";
    errorResponse.code = err.code || "HTTP_ERROR";
  }

  // Erreur personnalisée avec code
  else if (err.code) {
    statusCode = err.status || 500;
    errorResponse.error = err.name || "Application Error";
    errorResponse.message = err.message;
    errorResponse.code = err.code;
  }

  // En développement, inclure plus de détails
  if (config.env === "development") {
    errorResponse.stack = err.stack;
    errorResponse.details = {
      name: err.name,
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
    };
  }

  // Statistiques d'erreur pour monitoring
  if (statusCode >= 500) {
    logger.error("Server error occurred", {
      statusCode,
      errorCode: errorResponse.code,
      requestId: req.id,
      endpoint: req.originalUrl,
      method: req.method,
    });
  }

  // Réponse finale
  res.status(statusCode).json(errorResponse);
};

/**
 * Middleware pour les routes non trouvées (404)
 */
const notFoundHandler = (req, res) => {
  const errorResponse = {
    success: false,
    error: "Route not found",
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    code: "ROUTE_NOT_FOUND",
    requestId: req.id,
    timestamp: new Date().toISOString(),
  };

  logger.warn("Route not found", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    requestId: req.id,
  });

  res.status(404).json(errorResponse);
};

/**
 * Wrapper pour les fonctions async pour capturer automatiquement les erreurs
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Créer une erreur personnalisée
 */
const createError = (message, statusCode = 500, code = "APPLICATION_ERROR") => {
  const error = new Error(message);
  error.status = statusCode;
  error.code = code;
  return error;
};

/**
 * Validation des erreurs de proxy
 */
const proxyErrorHandler = (err, req, res, next) => {
  if (err.code === "ECONNREFUSED") {
    const serviceName = req.originalUrl.split("/")[2]; // Extraire le nom du service de l'URL

    logger.error("Microservice connection failed", {
      service: serviceName,
      url: req.originalUrl,
      error: err.message,
      requestId: req.id,
    });

    return res.status(503).json({
      success: false,
      error: "Service unavailable",
      message: `The ${serviceName} service is temporarily unavailable`,
      code: "MICROSERVICE_UNAVAILABLE",
      service: serviceName,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    });
  }

  next(err);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createError,
  proxyErrorHandler,
};
