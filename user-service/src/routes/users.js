/**
 * Routes de gestion utilisateur - User Service
 */

const express = require("express");
const router = express.Router();

// Contrôleurs
const userController = require("../controllers/userController");
const User = require("../models/User");
const logger = require("../utils/logger");

// Middlewares
const { validate } = require("../utils/validation");
const {
  updateProfileSchema,
  changePasswordSchema,
} = require("../utils/validation");
const {
  authenticateToken,
  rateLimiter,
  auditLog,
  requireRole,
} = require("../middleware/auth");

/**
 * PUT /users/profile - Mettre à jour le profil utilisateur
 */
router.put(
  "/profile",
  [
    // Authentification requise
    authenticateToken,
    // Rate limiting
    rateLimiter({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 mises à jour max en 5 min
      message: "Too many profile update attempts. Please try again later.",
    }),
    // Validation des données
    validate(updateProfileSchema),
    // Audit log
    auditLog("profile_update"),
  ],
  userController.updateProfile
);

/**
 * PUT /users/password - Changer le mot de passe
 */
router.put(
  "/password",
  [
    // Authentification requise
    authenticateToken,
    // Rate limiting strict
    rateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 3, // 3 changements max en 15 min
      message:
        "Too many password change attempts. Please try again in 15 minutes.",
    }),
    // Validation des données
    validate(changePasswordSchema),
    // Audit log
    auditLog("password_change"),
  ],
  userController.changePassword
);

/**
 * GET /users/sessions - Obtenir les sessions actives
 */
router.get(
  "/sessions",
  [
    // Authentification requise
    authenticateToken,
    // Rate limiting léger
    rateLimiter({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 20, // 20 requêtes max par minute
    }),
  ],
  userController.getActiveSessions
);

/**
 * DELETE /users/sessions/:sessionId - Révoquer une session spécifique
 */
router.delete(
  "/sessions/:sessionId",
  [
    // Authentification requise
    authenticateToken,
    // Rate limiting
    rateLimiter({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 20, // 20 révocations max en 5 min
    }),
    // Audit log
    auditLog("session_revocation"),
  ],
  userController.revokeSession
);

/**
 * DELETE /users/account - Supprimer le compte utilisateur
 */
router.delete(
  "/account",
  [
    // Authentification requise
    authenticateToken,
    // Rate limiting très strict
    rateLimiter({
      windowMs: 60 * 60 * 1000, // 1 heure
      max: 1, // 1 seule tentative par heure
      message: "Account deletion can only be attempted once per hour.",
    }),
    // Audit log
    auditLog("account_deletion"),
  ],
  userController.deleteAccount
);

/**
 * GET /users/:userId - Obtenir le profil d'un utilisateur (admin seulement)
 */
router.get(
  "/:userId",
  [
    // Authentification requise
    authenticateToken,
    // Rôle admin requis
    requireRole("admin"),
    // Rate limiting
    rateLimiter({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 50, // 50 requêtes max par minute pour les admins
    }),
  ],
  async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      logger.error("Get user by ID error", {
        error: error.message,
        userId: req.params.userId,
        adminId: req.user.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to fetch user",
        message: "An unexpected error occurred",
      });
    }
  }
);

/**
 * GET /users - Lister les utilisateurs (admin seulement)
 */
router.get(
  "/",
  [
    // Authentification requise
    authenticateToken,
    // Rôle admin requis
    requireRole("admin"),
    // Rate limiting
    rateLimiter({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 20, // 20 requêtes max par minute
    }),
  ],
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        status = "all",
        sortBy = "created_at",
        sortOrder = "desc",
      } = req.query;

      const users = await User.findAll({
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        search,
        status,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        data: {
          users: users.map((user) => user.toJSON()),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: users.length,
          },
        },
      });
    } catch (error) {
      logger.error("List users error", {
        error: error.message,
        adminId: req.user.id,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        error: "Failed to fetch users",
        message: "An unexpected error occurred",
      });
    }
  }
);

/**
 * PUT /users/:userId/status - Activer/désactiver un utilisateur (admin seulement)
 */
router.put(
  "/:userId/status",
  [
    // Authentification requise
    authenticateToken,
    // Rôle admin requis
    requireRole("admin"),
    // Rate limiting
    rateLimiter({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 20, // 20 changements max en 5 min
    }),
    // Audit log
    auditLog("user_status_change"),
  ],
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { is_active, reason } = req.body;

      if (typeof is_active !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "Invalid status",
          message: "is_active must be a boolean value",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Empêcher l'admin de se désactiver lui-même
      if (userId === req.user.id) {
        return res.status(400).json({
          success: false,
          error: "Cannot change your own status",
          message: "You cannot activate or deactivate your own account",
        });
      }

      await user.updateProfile({ is_active });

      logger.audit("User status changed by admin", {
        targetUserId: userId,
        targetUserEmail: user.email,
        adminId: req.user.id,
        adminEmail: req.user.email,
        newStatus: is_active,
        reason: reason || "No reason provided",
        ip: req.ip,
      });

      res.json({
        success: true,
        message: `User ${is_active ? "activated" : "deactivated"} successfully`,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      logger.error("Change user status error", {
        error: error.message,
        userId: req.params.userId,
        adminId: req.user.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to change user status",
        message: "An unexpected error occurred",
      });
    }
  }
);

/**
 * GET /users/health - Health check
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "user-service-users",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    status: "healthy",
  });
});

module.exports = router;
