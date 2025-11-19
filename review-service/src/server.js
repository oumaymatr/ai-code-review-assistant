const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const config = require("./config");
const logger = require("./utils/logger");
const { connectRedis } = require("./db/redis");

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
const authMiddleware = require("./middleware/auth");
const healthRoutes = require("./routes/health");
const reviewRoutes = require("./routes/reviews");
const uploadRoutes = require("./routes/uploads");

app.use("/health", healthRoutes);
app.use("/api/reviews", authMiddleware, reviewRoutes);
app.use("/api/uploads", authMiddleware, uploadRoutes);

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

    // Start server
    app.listen(config.port, () => {
      logger.info(`Review Service running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Code Analysis Service: ${config.codeAnalysisServiceUrl}`);
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
