/**
 * Middleware de Rate Limiting intelligent
 */

const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const redis = require("redis");
const config = require("../config/config");
const logger = require("../utils/logger");

// Connection Redis pour le rate limiting
let redisClient;
const initRedis = async () => {
  try {
    redisClient = redis.createClient({ url: config.redis.url });
    await redisClient.connect();
    logger.info("Redis connected for rate limiting");
  } catch (error) {
    logger.error("Redis connection failed for rate limiting", {
      error: error.message,
    });
  }
};

initRedis();

/**
 * Store Redis pour rate limiting
 */
class RedisStore {
  constructor(prefix = "rl:") {
    this.prefix = prefix;
  }

  async increment(key, windowMs) {
    if (!redisClient || !redisClient.isReady) {
      return { totalHits: 1, timeToExpire: windowMs };
    }

    try {
      const redisKey = `${this.prefix}${key}`;
      const current = await redisClient.incr(redisKey);

      if (current === 1) {
        await redisClient.expire(redisKey, Math.ceil(windowMs / 1000));
      }

      const ttl = await redisClient.ttl(redisKey);

      return {
        totalHits: current,
        timeToExpire: ttl * 1000,
      };
    } catch (error) {
      logger.error("Redis rate limit error", { error: error.message });
      return { totalHits: 1, timeToExpire: windowMs };
    }
  }

  async decrement(key) {
    if (!redisClient || !redisClient.isReady) return;

    try {
      await redisClient.decr(`${this.prefix}${key}`);
    } catch (error) {
      logger.error("Redis decrement error", { error: error.message });
    }
  }

  async resetKey(key) {
    if (!redisClient || !redisClient.isReady) return;

    try {
      await redisClient.del(`${this.prefix}${key}`);
    } catch (error) {
      logger.error("Redis reset key error", { error: error.message });
    }
  }
}

/**
 * Key generator pour identifier les clients
 */
const keyGenerator = (req) => {
  // Utiliser l'ID utilisateur si authentifié, sinon IP
  if (req.user && req.user.userId) {
    return `user:${req.user.userId}`;
  }
  return `ip:${req.ip}`;
};

/**
 * Handler personnalisé pour rate limit exceeded
 */
const rateLimitHandler = (req, res) => {
  const identifier = keyGenerator(req);

  logger.security("Rate limit exceeded", {
    identifier,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    endpoint: req.originalUrl,
    method: req.method,
  });

  res.status(429).json({
    success: false,
    error: "Too many requests",
    message: "Rate limit exceeded. Please try again later.",
    retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000),
    code: "RATE_LIMIT_EXCEEDED",
  });
};

/**
 * Rate limiter général
 */
const generalLimiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.maxRequests,
  store: new RedisStore("general:"),
  keyGenerator,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip pour les health checks
    return req.path === "/health" || req.path === "/metrics";
  },
});

/**
 * Rate limiter strict pour authentification
 */
const authLimiter = rateLimit({
  windowMs: config.rateLimiting.auth.windowMs,
  max: config.rateLimiting.auth.maxRequests,
  store: new RedisStore("auth:"),
  keyGenerator,
  handler: (req, res) => {
    logger.security("Auth rate limit exceeded", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      error: "Too many authentication attempts",
      message: "Please wait before trying to login again.",
      retryAfter: Math.ceil(config.rateLimiting.auth.windowMs / 1000),
      code: "AUTH_RATE_LIMIT_EXCEEDED",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter pour uploads
 */
const uploadLimiter = rateLimit({
  windowMs: config.rateLimiting.upload.windowMs,
  max: config.rateLimiting.upload.maxRequests,
  store: new RedisStore("upload:"),
  keyGenerator,
  handler: (req, res) => {
    logger.security("Upload rate limit exceeded", {
      identifier: keyGenerator(req),
      ip: req.ip,
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      error: "Too many uploads",
      message: "Please wait before uploading another file.",
      retryAfter: Math.ceil(config.rateLimiting.upload.windowMs / 1000),
      code: "UPLOAD_RATE_LIMIT_EXCEEDED",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter pour analyses de code
 */
const analysisLimiter = rateLimit({
  windowMs: config.rateLimiting.analysis.windowMs,
  max: config.rateLimiting.analysis.maxRequests,
  store: new RedisStore("analysis:"),
  keyGenerator,
  handler: (req, res) => {
    logger.security("Analysis rate limit exceeded", {
      identifier: keyGenerator(req),
      ip: req.ip,
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      error: "Too many analysis requests",
      message: "Please wait before requesting another code analysis.",
      retryAfter: Math.ceil(config.rateLimiting.analysis.windowMs / 1000),
      code: "ANALYSIS_RATE_LIMIT_EXCEEDED",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Slow down middleware pour ralentir les requêtes répétées
 */
const speedLimiter = slowDown({
  windowMs: 5 * 60 * 1000, // 5 minutes
  delayAfter: 50, // Commencer à ralentir après 50 requêtes
  delayMs: 500, // Ajouter 500ms de délai
  maxDelayMs: 10000, // Maximum 10 secondes
  keyGenerator,
  skip: (req) => {
    return req.path === "/health" || req.path === "/metrics";
  },
  onLimitReached: (req) => {
    logger.performance("Speed limit reached", {
      identifier: keyGenerator(req),
      ip: req.ip,
      endpoint: req.originalUrl,
    });
  },
});

/**
 * Middleware pour logger les métriques de rate limiting
 */
const rateLimitMetrics = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (body) {
    // Logger les headers de rate limiting
    if (res.get("X-RateLimit-Remaining")) {
      logger.performance("Rate limit metrics", {
        identifier: keyGenerator(req),
        endpoint: req.originalUrl,
        remaining: res.get("X-RateLimit-Remaining"),
        limit: res.get("X-RateLimit-Limit"),
        reset: res.get("X-RateLimit-Reset"),
      });
    }

    originalSend.call(this, body);
  };

  next();
};

module.exports = {
  general: generalLimiter,
  auth: authLimiter,
  upload: uploadLimiter,
  analysis: analysisLimiter,
  speedLimiter,
  rateLimitMetrics,
  RedisStore,
};
