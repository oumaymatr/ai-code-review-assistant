const redis = require("redis");
const config = require("../config");
const logger = require("../utils/logger");

let client = null;

async function connectRedis() {
  try {
    client = redis.createClient({
      url: config.redis.url,
    });

    client.on("error", (err) => logger.error("Redis error:", err));
    client.on("connect", () => logger.info("Redis connected"));

    await client.connect();
    return client;
  } catch (error) {
    logger.error("Redis connection failed:", error);
    return null;
  }
}

function getRedisClient() {
  return client;
}

module.exports = { connectRedis, getRedisClient };
