require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const config = require("./config/config");

const logger = require("./utils/logger");

const { healthCheck, closeConnections } = require("./config/database");

const routes = require("./routes");

const app = express();

// Security Middleware
app.use(helmet());

// Logging
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// CORS Configuration
app.use(
  cors({
    origin: config.cors?.allowedOrigins || "*",
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes principales
app.use("/api", routes);

// Route racine
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "AI Code Review Assistant - User Service",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// 404 Handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

// Error Handler
app.use((error, req, res, next) => {
  logger.error("Server error", { error: error.message, stack: error.stack });
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message:
      config.env === "development"
        ? error.message
        : "An unexpected error occurred",
  });
});

const PORT = config.port;
const server = app.listen(PORT, () => {
  logger.info(`User Service started on port ${PORT}`);

  // Test santé des connexions après démarrage
  setTimeout(async () => {
    try {
      const health = await healthCheck();
      logger.info("Database health check", health);
    } catch (error) {
      logger.warning("Database health check failed", { error: error.message });
    }
  }, 2000);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    try {
      await closeConnections();
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", { error: error.message });
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

module.exports = app;
