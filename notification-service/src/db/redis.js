const redis = require("redis");
const config = require("../config");
const logger = require("../utils/logger");

let client = null;
let pubClient = null;
let subClient = null;

async function connectRedis() {
  try {
    // Main client
    client = redis.createClient({ url: config.redis.url });
    client.on("error", (err) => logger.error("Redis error:", err));
    client.on("connect", () => logger.info("Redis connected"));
    await client.connect();

    // Pub/Sub clients for real-time notifications
    pubClient = redis.createClient({ url: config.redis.url });
    await pubClient.connect();

    subClient = redis.createClient({ url: config.redis.url });
    await subClient.connect();

    logger.info("Redis Pub/Sub clients connected");

    return { client, pubClient, subClient };
  } catch (error) {
    logger.error("Redis connection failed:", error);
    return { client: null, pubClient: null, subClient: null };
  }
}

function getRedisClient() {
  return client;
}

function getPubClient() {
  return pubClient;
}

function getSubClient() {
  return subClient;
}

module.exports = {
  connectRedis,
  getRedisClient,
  getPubClient,
  getSubClient,
};
