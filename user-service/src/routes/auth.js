/**
 * Routes d'authentification - User Service
 */

const express = require("express");
const router = express.Router();

// Contrôleurs
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");

// Middlewares
const { validate } = require("../utils/validation");
const {
  registerSchema,
  loginSchema,
  passwordResetSchema,
  passwordResetConfirmSchema,
} = require("../utils/validation");
const {
  authenticateToken,
  rateLimiter,
  checkFailedAttempts,
  auditLog,
} = require("../middleware/auth");

/**
 * POST /auth/register - Inscription utilisateur
 */
router.post(
  "/register",
  [
    // Rate limiting plus strict pour l'inscription
    rateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // 50 inscriptions max par IP en 15 min (mode dev)
      message:
        "Too many registration attempts. Please try again in 15 minutes.",
    }),
    // Validation des données
    validate(registerSchema),
    // Audit log
    auditLog("user_registration"),
  ],
  authController.register
);

/**
 * POST /auth/login - Connexion utilisateur
 */
router.post(
  "/login",
  [
    // Rate limiting pour les tentatives de connexion
    rateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 tentatives max par IP en 15 min
      message: "Too many login attempts. Please try again in 15 minutes.",
    }),
    // Vérifier les tentatives échouées
    checkFailedAttempts,
    // Validation des données
    validate(loginSchema),
    // Audit log
    auditLog("user_login"),
  ],
  authController.login
);

/**
 * POST /auth/logout - Déconnexion utilisateur
 */
router.post(
  "/logout",
  [
    // Authentification requise
    authenticateToken,
    // Audit log
    auditLog("user_logout"),
  ],
  authController.logout
);

/**
 * POST /auth/refresh - Renouveler le token d'accès
 */
router.post(
  "/refresh",
  [
    // Rate limiting
    rateLimiter({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 20, // 20 refresh max par IP en 5 min
      message: "Too many token refresh attempts. Please try again later.",
    }),
  ],
  authController.refreshToken
);

/**
 * GET /auth/profile - Obtenir le profil utilisateur
 */
router.get(
  "/profile",
  [
    // Authentification requise
    authenticateToken,
    // Rate limiting léger
    rateLimiter({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // 30 requêtes max par minute
    }),
  ],
  authController.getProfile
);

/**
 * GET /auth/stats - Obtenir les statistiques utilisateur
 */
router.get(
  "/stats",
  [
    // Authentification requise
    authenticateToken,
    // Rate limiting léger
    rateLimiter({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 10, // 10 requêtes max par minute
    }),
  ],
  authController.getUserStats
);

/**
 * POST /auth/password/reset - Demander une réinitialisation de mot de passe
 */
router.post(
  "/password/reset",
  [
    // Rate limiting strict
    rateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 3, // 3 demandes max par IP en 15 min
      message:
        "Too many password reset requests. Please try again in 15 minutes.",
    }),
    // Validation
    validate(passwordResetSchema),
    // Audit log
    auditLog("password_reset_request"),
  ],
  userController.requestPasswordReset
);

/**
 * POST /auth/password/reset/confirm - Confirmer la réinitialisation
 */
router.post(
  "/password/reset/confirm",
  [
    // Rate limiting
    rateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 confirmations max par IP en 15 min
      message:
        "Too many password reset confirmation attempts. Please try again later.",
    }),
    // Validation
    validate(passwordResetConfirmSchema),
    // Audit log
    auditLog("password_reset_confirm"),
  ],
  userController.confirmPasswordReset
);

/**
 * GET /auth/health - Health check pour l'authentification
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "user-service-auth",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    status: "healthy",
  });
});

module.exports = router;
