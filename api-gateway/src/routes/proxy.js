/**
 * Routes de Proxy vers microservices
 */

const express = require('express');
const router = express.Router();
const proxy = require('../middleware/proxy');
const rateLimiter = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Middleware global pour toutes les routes API
 */
router.use(proxy.proxyMetrics);

/**
 * ROUTES USER SERVICE
 * /api/users/* → user-service/api/users/*
 * /api/auth/* → user-service/api/auth/*
 */
router.use('/users*', (req, res, next) => {
  logger.proxy('Routing to user service', {
    originalUrl: req.originalUrl,
    method: req.method,
    requestId: req.id
  });

  proxy.userServiceProxy(req, res, next);
});

router.use('/auth*', (req, res, next) => {
  logger.proxy('Routing to user service (auth)', {
    originalUrl: req.originalUrl,
    method: req.method,
    requestId: req.id
  });

  proxy.userServiceProxy(req, res, next);
});

/**
 * ROUTES REVIEW SERVICE
 * /api/reviews/* → review-service/api/reviews/*
 */
router.use('/reviews*', (req, res, next) => {
  // Rate limiting spécial pour les uploads
  if (req.originalUrl.includes('/upload')) {
    return rateLimiter.upload(req, res, () => {
      logger.proxy('Routing to review service (upload)', {
        originalUrl: req.originalUrl,
        method: req.method,
        requestId: req.id,
        userId: req.user?.userId
      });

      proxy.reviewServiceProxy(req, res, next);
    });
  }

  logger.proxy('Routing to review service', {
    originalUrl: req.originalUrl,
    method: req.method,
    requestId: req.id,
    userId: req.user?.userId
  });

  proxy.reviewServiceProxy(req, res, next);
});

/**
 * ROUTES CODE ANALYSIS SERVICE
 * /api/analyze/* → code-analysis-service/*
 */
router.use('/analyze*', rateLimiter.analysis, (req, res, next) => {
  logger.proxy('Routing to code analysis service', {
    originalUrl: req.originalUrl,
    method: req.method,
    requestId: req.id,
    userId: req.user?.userId
  });

  proxy.codeAnalysisProxy(req, res, next);
});

/**
 * ROUTES NOTIFICATION SERVICE
 * /api/notifications/* → notification-service/*
 */
router.use('/notifications*', (req, res, next) => {
  logger.proxy('Routing to notification service', {
    originalUrl: req.originalUrl,
    method: req.method,
    requestId: req.id,
    userId: req.user?.userId
  });

  proxy.notificationServiceProxy(req, res, next);
});

/**
 * ROUTE CUSTOM - Statistiques utilisateur
 * Agrégation de données depuis plusieurs microservices
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const axios = require('axios');
    const config = require('../config/config');

    logger.api('Fetching user statistics', {
      userId,
      requestId: req.id
    });

    try {
      // Appel parallèle aux différents services
      const [userStats, reviewStats] = await Promise.allSettled([
        // Stats utilisateur
        axios.get(`${config.services.userService}/users/${userId}/stats`, {
          headers: { Authorization: req.headers.authorization }
        }),

        // Stats des reviews
        axios.get(`${config.services.reviewService}/reviews/stats`, {
          headers: { Authorization: req.headers.authorization }
        })
      ]);

      const response = {
        success: true,
        stats: {
          user:
            userStats.status === 'fulfilled'
              ? userStats.value.data
              : { error: 'User stats unavailable' },
          reviews:
            reviewStats.status === 'fulfilled'
              ? reviewStats.value.data
              : { error: 'Review stats unavailable' }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to fetch user statistics', {
        error: error.message,
        userId,
        requestId: req.id
      });

      throw error;
    }
  })
);

/**
 * ROUTE CUSTOM - Recherche globale
 * Recherche dans plusieurs services
 */
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q: query, type = 'all' } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query',
        message: 'Search query must be at least 2 characters long',
        code: 'QUERY_TOO_SHORT'
      });
    }

    const userId = req.user.userId;
    const axios = require('axios');
    const config = require('../config/config');

    logger.api('Global search initiated', {
      query,
      type,
      userId,
      requestId: req.id
    });

    try {
      const searches = [];

      // Recherche dans les reviews si demandé
      if (type === 'all' || type === 'reviews') {
        searches.push(
          axios
            .get(
              `${config.services.reviewService}/search?q=${encodeURIComponent(query)}`,
              {
                headers: { Authorization: req.headers.authorization }
              }
            )
            .then((response) => ({ type: 'reviews', data: response.data }))
            .catch(() => ({ type: 'reviews', error: 'Search unavailable' }))
        );
      }

      // Attendre tous les résultats
      const results = await Promise.all(searches);

      res.json({
        success: true,
        query,
        results: results.reduce((acc, result) => {
          acc[result.type] = result.data || { error: result.error };
          return acc;
        }, {}),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Global search failed', {
        error: error.message,
        query,
        userId,
        requestId: req.id
      });

      throw error;
    }
  })
);

/**
 * ROUTE CUSTOM - Health check de tous les services
 */
router.get('/services/health', proxy.healthCheckProxy);

/**
 * ROUTE CUSTOM - Configuration publique
 */
router.get('/config', (req, res) => {
  const config = require('../config/config');

  // Retourner seulement les configs publiques
  res.json({
    success: true,
    config: {
      upload: {
        maxFileSize: config.upload.maxFileSize,
        allowedTypes: config.upload.allowedTypes
      },
      rateLimiting: {
        windowMs: config.rateLimiting.windowMs,
        maxRequests: config.rateLimiting.maxRequests
      },
      version: require('../../package.json').version,
      environment: config.env === 'development' ? 'development' : 'production'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
