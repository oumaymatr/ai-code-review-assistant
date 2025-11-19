/**
 * Routes de Health Check
 */

const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");

/**
 * Health check simple
 */
router.get("/", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: require("../../package.json").version,
    environment: process.env.NODE_ENV,
  });
});

/**
 * Health check détaillé avec vérification des dépendances
 */
router.get("/detailed", async (req, res) => {
  try {
    const redis = require("redis");
    const config = require("../config/config");

    let checks = {
      server: "healthy",
      redis: "unknown",
      timestamp: new Date().toISOString(),
    };

    // Test Redis
    try {
      const client = redis.createClient({ url: config.redis.url });
      await client.connect();
      await client.ping();
      await client.disconnect();
      checks.redis = "healthy";
    } catch (error) {
      checks.redis = "unhealthy";
      logger.warn("Redis health check failed", { error: error.message });
    }

    const allHealthy = Object.values(checks).every(
      (status) => status === "healthy" || status === new Date().toISOString()
    );

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? "healthy" : "degraded",
      checks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: require("../../package.json").version,
    });
  } catch (error) {
    logger.error("Detailed health check failed", { error: error.message });
    res.status(500).json({
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Readiness check (pour Kubernetes)
 */
router.get("/ready", (req, res) => {
  // Vérifier si l'application est prête à recevoir du trafic
  res.status(200).json({
    status: "ready",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Liveness check (pour Kubernetes)
 */
router.get("/live", (req, res) => {
  // Vérifier si l'application est vivante
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
