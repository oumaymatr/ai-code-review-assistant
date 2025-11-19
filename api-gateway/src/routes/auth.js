/**
 * Routes d'authentification
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Proxy vers le User Service pour l'authentification
 * Avec rate limiting spécial pour les tentatives de connexion
 */

// Apply rate limiting pour les routes d'auth
router.use(rateLimiter.auth);

/**
 * POST /auth/register - Inscription
 * Proxy vers user-service/auth/register
 */
router.post(
  '/register',
  asyncHandler(async (req, res, next) => {
    logger.auth('Registration attempt', {
      email: req.body?.email,
      username: req.body?.username,
      ip: req.ip,
      requestId: req.id
    });

    // Validation basique côté gateway
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Email, username and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Validation email simple
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        message: 'Please provide a valid email address',
        code: 'INVALID_EMAIL'
      });
    }

    // Validation mot de passe
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password too short',
        message: 'Password must be at least 6 characters long',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    // Proxy vers le user service
    const userServiceProxy = require('../middleware/proxy').userServiceProxy;
    userServiceProxy(req, res, next);
  })
);

/**
 * POST /auth/login - Connexion
 * Proxy vers user-service/auth/login
 */
router.post(
  '/login',
  asyncHandler(async (req, res, next) => {
    logger.auth('Login attempt', {
      email: req.body?.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id
    });

    // Validation basique côté gateway
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing credentials',
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Proxy vers le user service
    const userServiceProxy = require('../middleware/proxy').userServiceProxy;
    userServiceProxy(req, res, next);
  })
);

/**
 * POST /auth/logout - Déconnexion
 * Blacklist le token JWT
 */
router.post(
  '/logout',
  authMiddleware.verifyToken,
  asyncHandler(async (req, res) => {
    try {
      // Blacklist le token
      await authMiddleware.blacklistToken(req.token);

      logger.auth('User logged out', {
        userId: req.user.userId,
        email: req.user.email,
        requestId: req.id
      });

      res.json({
        success: true,
        message: 'Successfully logged out',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Logout error', {
        error: error.message,
        userId: req.user?.userId,
        requestId: req.id
      });

      throw error;
    }
  })
);

/**
 * POST /auth/refresh - Refresh token
 * Générer un nouveau token JWT
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res, next) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing refresh token',
        message: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    logger.auth('Token refresh attempt', {
      ip: req.ip,
      requestId: req.id
    });

    // Proxy vers le user service pour gérer le refresh
    const userServiceProxy = require('../middleware/proxy').userServiceProxy;
    userServiceProxy(req, res, next);
  })
);

/**
 * GET /auth/me - Informations utilisateur actuel
 * Retourne les infos du token JWT (pas besoin de proxy)
 */
router.get(
  '/me',
  authMiddleware.verifyToken,
  asyncHandler(async (req, res) => {
    // Retourner les infos du token directement
    const userInfo = {
      userId: req.user.userId,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role,
      tokenIssuedAt: new Date(req.user.iat * 1000).toISOString(),
      tokenExpiresAt: new Date(req.user.exp * 1000).toISOString()
    };

    logger.auth('User info requested', {
      userId: req.user.userId,
      requestId: req.id
    });

    res.json({
      success: true,
      user: userInfo,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * POST /auth/verify-token - Vérifier un token JWT
 * Utilisé par les autres microservices
 */
router.post(
  '/verify-token',
  asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing token',
        message: 'Token is required',
        code: 'MISSING_TOKEN'
      });
    }

    try {
      const jwt = require('jsonwebtoken');
      const config = require('../config/config');

      // Vérifier le token
      const decoded = jwt.verify(token, config.jwt.secret);

      // Vérifier la blacklist
      const redis = require('redis');
      const redisClient = redis.createClient({ url: config.redis.url });
      await redisClient.connect();

      const isBlacklisted = await redisClient.get(
        `${config.redis.prefix}blacklist:${token}`
      );
      await redisClient.disconnect();

      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          error: 'Token revoked',
          message: 'Token has been revoked',
          code: 'TOKEN_REVOKED'
        });
      }

      res.json({
        success: true,
        valid: true,
        user: {
          userId: decoded.userId,
          email: decoded.email,
          username: decoded.username,
          role: decoded.role,
          iat: decoded.iat,
          exp: decoded.exp
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        valid: false,
        error: error.message,
        code: 'INVALID_TOKEN'
      });
    }
  })
);

module.exports = router;
