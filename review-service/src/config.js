require("dotenv").config();

const config = {
  // Service
  port: process.env.PORT || 5002,
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

  // Code Analysis Service
  codeAnalysisServiceUrl:
    process.env.CODE_ANALYSIS_SERVICE_URL || "http://localhost:3003",

  // Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedExtensions: [
      ".js",
      ".ts",
      ".py",
      ".java",
      ".go",
      ".rs",
      ".cpp",
      ".c",
      ".h",
      ".jsx",
      ".tsx",
    ],
  },

  // Review Configuration
  review: {
    maxCodeLength: parseInt(process.env.MAX_CODE_LENGTH) || 50000,
    autoAnalysis: process.env.AUTO_ANALYSIS !== "false",
  },

  // JWT
  jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
};

console.log("Review Service Config - JWT_SECRET:", config.jwtSecret);

module.exports = config;
