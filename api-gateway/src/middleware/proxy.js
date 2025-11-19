/**
 * Middleware de Proxy vers microservices
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Configuration de base pour tous les proxies
 */
const baseProxyConfig = {
  changeOrigin: true,
  secure: false,
  timeout: 30000, // 30 secondes
  proxyTimeout: 30000,

  // Log des requêtes proxy
  onProxyReq: (proxyReq, req) => {
    logger.proxy('Proxying request', {
      originalUrl: req.originalUrl,
      targetUrl: proxyReq.path,
      method: req.method,
      requestId: req.id,
      userId: req.user?.userId || 'anonymous'
    });

    // Ajouter des headers personnalisés
    proxyReq.setHeader('X-Request-ID', req.id);
    if (req.user) {
      proxyReq.setHeader('X-User-ID', req.user.userId);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },

  // Log des réponses
  onProxyRes: (proxyRes, req) => {
    const duration = Date.now() - req.timestamp;

    logger.proxy('Proxy response received', {
      statusCode: proxyRes.statusCode,
      duration: `${duration}ms`,
      requestId: req.id,
      originalUrl: req.originalUrl
    });
  },

  // Gestion des erreurs de proxy
  onError: (err, req, res) => {
    logger.error('Proxy error', {
      error: err.message,
      code: err.code,
      requestId: req.id,
      originalUrl: req.originalUrl,
      target: err.target || 'unknown'
    });

    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'Unable to reach the requested service',
        code: 'PROXY_ERROR',
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    }
  }
};

/**
 * Proxy vers User Service
 */
const userServiceProxy = createProxyMiddleware({
  ...baseProxyConfig,
  target: config.services.userService,
  pathRewrite: {
    '^/api': '/api'
  },

  // Headers spéciaux pour User Service
  onProxyReq: (proxyReq, req) => {
    baseProxyConfig.onProxyReq(proxyReq, req);
    proxyReq.setHeader('X-Service-Name', 'user-service');

    // Passer le token JWT au service
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }

    // Réécrire le body pour POST/PUT/PATCH
    if (
      req.body &&
      (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
    ) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
});

/**
 * Proxy vers Review Service
 */
const reviewServiceProxy = createProxyMiddleware({
  ...baseProxyConfig,
  target: config.services.reviewService,
  pathRewrite: {
    '^/api/reviews': '/api/reviews'
  },

  onProxyReq: (proxyReq, req) => {
    baseProxyConfig.onProxyReq(proxyReq, req);
    proxyReq.setHeader('X-Service-Name', 'review-service');

    // Réécrire le body pour POST/PUT/PATCH (sauf pour les uploads multipart)
    if (
      req.body &&
      (req.method === 'POST' ||
        req.method === 'PUT' ||
        req.method === 'PATCH') &&
      !req.originalUrl.includes('/upload')
    ) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
});

/**
 * Proxy vers Code Analysis Service
 */
const codeAnalysisProxy = createProxyMiddleware({
  ...baseProxyConfig,
  target: config.services.codeAnalysisService,
  // Increase to 5 minutes to allow long-running model initialization/requests
  timeout: 300000, // 5 minutes pour l'IA
  proxyTimeout: 300000,
  pathRewrite: {
    '^/api/analyze': ''
  },

  onProxyReq: (proxyReq, req) => {
    baseProxyConfig.onProxyReq(proxyReq, req);
    proxyReq.setHeader('X-Service-Name', 'code-analysis-service');

    // Réécrire le body pour POST/PUT/PATCH
    if (
      req.body &&
      (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
    ) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
});

/**
 * Proxy vers Notification Service
 */
const notificationServiceProxy = createProxyMiddleware({
  ...baseProxyConfig,
  target: config.services.notificationService,
  pathRewrite: {
    '^/api/notifications': ''
  },

  onProxyReq: (proxyReq, req) => {
    baseProxyConfig.onProxyReq(proxyReq, req);
    proxyReq.setHeader('X-Service-Name', 'notification-service');

    // Réécrire le body pour POST/PUT/PATCH
    if (
      req.body &&
      (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
    ) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
});

/**
 * Health check proxy - vérifie la santé de tous les services
 */
const healthCheckProxy = async (req, res) => {
  try {
    const axios = require('axios');
    const services = {
      userService: config.services.userService,
      reviewService: config.services.reviewService,
      codeAnalysisService: config.services.codeAnalysisService,
      notificationService: config.services.notificationService
    };

    const healthChecks = await Promise.allSettled(
      Object.entries(services).map(async ([name, url]) => {
        try {
          const response = await axios.get(`${url}/health`, { timeout: 5000 });
          return {
            name,
            status: 'healthy',
            url,
            response: response.status
          };
        } catch (error) {
          return {
            name,
            status: 'unhealthy',
            url,
            error: error.message
          };
        }
      })
    );

    const results = healthChecks.map((check) => check.value);
    const allHealthy = results.every((service) => service.status === 'healthy');

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: results,
      uptime: process.uptime(),
      version: require('../../package.json').version
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Middleware de routing intelligent
 */
const smartRouter = (req, res, next) => {
  const path = req.originalUrl;

  // Routing basé sur le path
  if (path.startsWith('/api/auth') || path.startsWith('/api/users')) {
    return userServiceProxy(req, res, next);
  }

  if (path.startsWith('/api/reviews')) {
    return reviewServiceProxy(req, res, next);
  }

  if (path.startsWith('/api/analyze')) {
    return codeAnalysisProxy(req, res, next);
  }

  if (path.startsWith('/api/notifications')) {
    return notificationServiceProxy(req, res, next);
  }

  // Si aucun service ne correspond, passer au middleware suivant
  next();
};

/**
 * Middleware pour ajouter des métriques de proxy
 */
const proxyMetrics = (req, res, next) => {
  req.proxyStartTime = Date.now();

  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - req.proxyStartTime;

    logger.performance('Request completed', {
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      method: req.method,
      url: req.originalUrl,
      requestId: req.id,
      userId: req.user?.userId || 'anonymous'
    });

    originalEnd.apply(res, args);
  };

  next();
};

module.exports = {
  userServiceProxy,
  reviewServiceProxy,
  codeAnalysisProxy,
  notificationServiceProxy,
  healthCheckProxy,
  smartRouter,
  proxyMetrics
};
