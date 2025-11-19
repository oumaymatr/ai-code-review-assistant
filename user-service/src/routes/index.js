/**
 * Routes principales - User Service
 */

const express = require("express");
const router = express.Router();

// Routes spécialisées
const authRoutes = require("./auth");
const userRoutes = require("./users");

// Middlewares globaux pour les routes
const { corsHandler, securityHeaders } = require("../middleware/auth");
const logger = require("../utils/logger");

// Appliquer les middlewares de sécurité
router.use(corsHandler);
router.use(securityHeaders);

/**
 * GET / - Route racine avec informations sur le service
 */
router.get("/", (req, res) => {
  res.json({
    success: true,
    service: "AI Code Review Assistant - User Service",
    version: "1.0.0",
    description:
      "Microservice de gestion des utilisateurs et de l'authentification",
    features: [
      "Inscription et connexion utilisateur",
      "Authentification JWT avec refresh tokens",
      "Gestion des profils utilisateur",
      "Réinitialisation de mot de passe",
      "Gestion des sessions actives",
      "Rate limiting et sécurité",
      "Administration des utilisateurs",
    ],
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      health: "/api/health",
    },
    documentation: "/api/docs",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

/**
 * /auth - Routes d'authentification
 */
router.use("/auth", authRoutes);

/**
 * /users - Routes de gestion des utilisateurs
 */
router.use("/users", userRoutes);

/**
 * GET /health - Health check détaillé du service
 */
router.get("/health", async (req, res) => {
  try {
    const healthStatus = {
      success: true,
      service: "user-service",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      cpu: process.cpuUsage(),
      node_version: process.version,
      environment: process.env.NODE_ENV || "development",
      dependencies: {},
    };

    // Vérifier la connexion à la base de données
    try {
      const { pool } = require("../config/database");
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      healthStatus.dependencies.postgresql = {
        status: "connected",
        latency: 0,
      };
    } catch (error) {
      healthStatus.dependencies.postgresql = {
        status: "error",
        error: error.message,
      };
      healthStatus.success = false;
    }

    // Vérifier la connexion à Redis
    try {
      const { redisClient } = require("../config/database");
      await redisClient.ping();
      healthStatus.dependencies.redis = { status: "connected", latency: 0 };
    } catch (error) {
      healthStatus.dependencies.redis = {
        status: "error",
        error: error.message,
      };
      healthStatus.success = false;
    }

    // Statistiques basiques
    try {
      const User = require("../models/User");
      const stats = await User.getServiceStats();
      healthStatus.statistics = stats;
    } catch (error) {
      logger.warning("Could not fetch service statistics", {
        error: error.message,
      });
    }

    const statusCode = healthStatus.success ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error("Health check error", { error: error.message });
    res.status(500).json({
      success: false,
      service: "user-service",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
      message: error.message,
    });
  }
});

/**
 * GET /docs - Documentation basique de l'API
 */
router.get("/docs", (req, res) => {
  res.json({
    success: true,
    title: "User Service API Documentation",
    version: "1.0.0",
    baseUrl: req.protocol + "://" + req.get("host") + "/api",
    endpoints: {
      authentication: {
        "POST /auth/register": {
          description: "Inscription d'un nouvel utilisateur",
          body: {
            email: "string (required)",
            username: "string (required)",
            password: "string (required)",
            confirmPassword: "string (required)",
            full_name: "string (optional)",
            acceptTerms: "boolean (required, must be true)",
          },
          response: {
            success: "boolean",
            message: "string",
            data: {
              user: "object",
              tokens: "object",
            },
          },
        },
        "POST /auth/login": {
          description: "Connexion utilisateur",
          body: {
            email: "string (required)",
            password: "string (required)",
            rememberMe: "boolean (optional)",
          },
          response: {
            success: "boolean",
            message: "string",
            data: {
              user: "object",
              tokens: "object",
            },
          },
        },
        "POST /auth/logout": {
          description: "Déconnexion utilisateur",
          headers: {
            Authorization: "Bearer <token> (required)",
          },
          response: {
            success: "boolean",
            message: "string",
          },
        },
        "POST /auth/refresh": {
          description: "Renouveler le token d'accès",
          body: {
            refreshToken: "string (required)",
          },
          response: {
            success: "boolean",
            message: "string",
            data: {
              tokens: "object",
            },
          },
        },
        "GET /auth/profile": {
          description: "Obtenir le profil de l'utilisateur connecté",
          headers: {
            Authorization: "Bearer <token> (required)",
          },
          response: {
            success: "boolean",
            data: {
              user: "object",
            },
          },
        },
      },
      user_management: {
        "PUT /users/profile": {
          description: "Mettre à jour le profil utilisateur",
          headers: {
            Authorization: "Bearer <token> (required)",
          },
          body: {
            full_name: "string (optional)",
            email: "string (optional)",
            avatar_url: "string (optional)",
          },
          response: {
            success: "boolean",
            message: "string",
            data: {
              user: "object",
            },
          },
        },
        "PUT /users/password": {
          description: "Changer le mot de passe",
          headers: {
            Authorization: "Bearer <token> (required)",
          },
          body: {
            currentPassword: "string (required)",
            newPassword: "string (required)",
            confirmNewPassword: "string (required)",
          },
          response: {
            success: "boolean",
            message: "string",
          },
        },
        "GET /users/sessions": {
          description: "Obtenir les sessions actives",
          headers: {
            Authorization: "Bearer <token> (required)",
          },
          response: {
            success: "boolean",
            data: {
              sessions: "array",
            },
          },
        },
      },
    },
    authentication: {
      type: "Bearer Token",
      header: "Authorization: Bearer <token>",
      note: "Obtenez un token via POST /auth/login ou POST /auth/register",
    },
    rate_limits: {
      registration: "5 requests per 15 minutes per IP",
      login: "10 requests per 15 minutes per IP",
      password_reset: "3 requests per 15 minutes per IP",
      general: "100 requests per 15 minutes per user/IP",
    },
    error_codes: {
      400: "Bad Request - Données invalides",
      401: "Unauthorized - Token manquant ou invalide",
      403: "Forbidden - Permissions insuffisantes",
      404: "Not Found - Ressource introuvable",
      409: "Conflict - Ressource déjà existante",
      429: "Too Many Requests - Limite de taux dépassée",
      500: "Internal Server Error - Erreur serveur",
    },
  });
});

/**
 * 404 - Handler pour les routes non trouvées
 */
router.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      "GET /",
      "GET /health",
      "GET /docs",
      "POST /auth/register",
      "POST /auth/login",
      "POST /auth/logout",
      "GET /auth/profile",
      "PUT /users/profile",
      "PUT /users/password",
    ],
  });
});

/**
 * Error handler pour les routes
 */
router.use((error, req, res, next) => {
  logger.error("Route error", {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "An unexpected error occurred",
    requestId: req.id || "unknown",
  });
});

module.exports = router;
