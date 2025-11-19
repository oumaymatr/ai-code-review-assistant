/**
 * Configuration et connexions base de données - User Service
 */

const { Pool } = require("pg");
const redis = require("redis");
const config = require("./config");
const logger = require("../utils/logger");

/**
 * Configuration PostgreSQL Pool
 */
const pool = new Pool({
  connectionString: config.database.url,
  max: config.database.options.max,
  min: config.database.options.min,
  idleTimeoutMillis: config.database.options.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.options.connectionTimeoutMillis,
  ssl: config.database.options.ssl,
});

/**
 * Configuration Redis Client - avec fallback
 */
let redisClient;

try {
  redisClient = redis.createClient({
    url: config.redis.url,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error("Redis max retries reached");
          return new Error("Max retries reached");
        }
        return Math.min(retries * 50, 500);
      },
    },
  });

  // Gestionnaires d'événements Redis
  redisClient.on("connect", () => {
    logger.info("Redis client connected successfully");
  });

  redisClient.on("ready", () => {
    logger.info("Redis client ready to accept commands");
  });

  redisClient.on("error", (error) => {
    logger.error("Redis connection error", { error: error.message });
  });

  redisClient.on("end", () => {
    logger.warning("Redis connection closed");
  });
} catch (error) {
  logger.error("Failed to create Redis client", { error: error.message });
  // Créer un client mock pour éviter les crashes
  redisClient = {
    get: async () => null,
    set: async () => "OK",
    setEx: async () => "OK",
    del: async () => 1,
    incr: async () => 1,
    expire: async () => 1,
    keys: async () => [],
    ping: async () => "PONG",
    connect: async () => {},
    disconnect: async () => {},
    isReady: false,
    isOpen: false,
  };
}

/**
 * Gestionnaires d'événements PostgreSQL
 */
pool.on("connect", (client) => {
  logger.info("New PostgreSQL client connected");
});

pool.on("error", (error) => {
  logger.error("PostgreSQL pool error", { error: error.message });
});

/**
 * Health Check des connexions
 */
const healthCheck = async () => {
  const health = {
    postgres: { status: "disconnected", latency: null },
    redis: { status: "disconnected", latency: null },
  };

  // Test PostgreSQL
  try {
    const start = Date.now();
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    health.postgres = {
      status: "connected",
      latency: Date.now() - start,
    };
  } catch (error) {
    health.postgres = {
      status: "error",
      error: error.message,
    };
  }

  // Test Redis
  try {
    const start = Date.now();
    if (!redisClient.isReady && redisClient.connect) {
      await redisClient.connect();
    }
    await redisClient.ping();
    health.redis = {
      status: "connected",
      latency: Date.now() - start,
    };
  } catch (error) {
    health.redis = {
      status: "error",
      error: error.message,
    };
  }

  return health;
};

/**
 * Fermeture propre des connexions
 */
const closeConnections = async () => {
  try {
    logger.info("Closing database connections...");

    // Fermer Redis
    if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
      await redisClient.quit();
      logger.info("Redis connection closed");
    }

    // Fermer PostgreSQL
    await pool.end();
    logger.info("PostgreSQL pool closed");
  } catch (error) {
    logger.error("Error closing database connections", {
      error: error.message,
    });
  }
};

module.exports = {
  pool,
  redisClient,
  healthCheck,
  closeConnections,
};
