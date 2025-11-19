const { Pool } = require("pg");
const config = require("../config");
const logger = require("../utils/logger");

const pool = new Pool({
  connectionString: config.database.connectionString,
  ssl: config.database.ssl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("connect", () => {
  logger.info("Database connected");
});

pool.on("error", (err) => {
  logger.error("Database error:", err);
});

module.exports = pool;
