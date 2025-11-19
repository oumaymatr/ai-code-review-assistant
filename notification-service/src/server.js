const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const config = require("./config");
const logger = require("./utils/logger");
const { connectRedis } = require("./db/redis");
const websocketService = require("./services/websocketService");

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
const authMiddleware = require("./middleware/auth");
const healthRoutes = require("./routes/health");
const notificationRoutes = require("./routes/notifications");

app.use("/health", healthRoutes);
app.use("/api/notifications", authMiddleware, notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Startup
async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();

    // Initialize WebSocket
    websocketService.initialize(server);

    // Start server
    server.listen(config.port, () => {
      logger.info(`Notification Service running on port ${config.port}`);
      logger.info(
        `WebSocket server available at ws://localhost:${config.port}/ws`
      );
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Only start server if not in test mode
if (process.env.NODE_ENV !== "test") {
  startServer();
}

module.exports = app;
