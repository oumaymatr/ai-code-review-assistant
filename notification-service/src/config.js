require("dotenv").config();

const config = {
  // Service
  port: process.env.PORT || 5004,
  nodeEnv: process.env.NODE_ENV || "development",

  // Database
  database: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres123@localhost:5432/ai_code_review_dev",
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  // WebSocket
  websocket: {
    pingInterval: 30000, // 30 seconds
  },

  // Email (optional - for production)
  email: {
    enabled: process.env.EMAIL_ENABLED === "true",
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER || "",
    password: process.env.EMAIL_PASSWORD || "",
    from: process.env.EMAIL_FROM || "noreply@ai-code-review.com",
  },
};

module.exports = config;
