/**
 * Configuration pour User Service
 */

const config = {
  // Environnement
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 3002,

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || "dev-jwt-secret-123",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    refreshExpiresIn: "7d",
    issuer: "ai-code-review-user-service",
    audience: "api-users",
  },

  // Database PostgreSQL
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://code_review_user:code_review_password@postgres:5432/code_review_db",
    host: process.env.DB_HOST || "postgres",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || "code_review_db",
    username: process.env.DB_USER || "code_review_user",
    password: process.env.DB_PASSWORD || "code_review_password",

    // Options de connexion
    options: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      idleTimeoutMillis: 30000, // Timeout idle
      connectionTimeoutMillis: 2000, // Timeout de connexion
      statement_timeout: 10000, // Timeout des requêtes
      query_timeout: 10000,
      application_name: "user-service",
    },
  },

  // Redis pour cache et sessions
  redis: {
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    password: process.env.REDIS_PASSWORD || undefined,
    url:
      process.env.REDIS_URL ||
      `redis://${process.env.REDIS_HOST || "redis"}:${process.env.REDIS_PORT || 6379}`,
    prefix: "user-service:",
    ttl: {
      session: 24 * 60 * 60, // 24 heures
      userCache: 60 * 60, // 1 heure
      passwordReset: 15 * 60, // 15 minutes
      emailVerification: 24 * 60 * 60, // 24 heures
    },
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || [
      "http://localhost:3000",
      "http://localhost:5000",
      "http://frontend:3000",
      "http://api-gateway:5000",
    ],
  },

  // Security & Password
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    maxLoginAttempts: 5,
    lockoutTime: 15 * 60 * 1000, // 15 minutes
    passwordMinLength: 6,
    passwordMaxLength: 128,

    // Regex pour validation
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    usernameRegex: /^[a-zA-Z0-9_-]{3,30}$/,
    passwordRegex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/,
  },

  // Email Configuration (optionnel)
  email: {
    service: process.env.EMAIL_SERVICE || "gmail",
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    from:
      process.env.EMAIL_FROM ||
      "AI Code Review Assistant <noreply@ai-review.com>",

    // Templates
    templates: {
      welcome: "welcome",
      emailVerification: "email-verification",
      passwordReset: "password-reset",
    },
  },

  // Upload Configuration pour avatars
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB pour les avatars
    allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    uploadPath: process.env.UPLOAD_PATH || "/app/uploads/avatars",

    // Configuration Sharp pour redimensionnement
    avatar: {
      width: 200,
      height: 200,
      quality: 80,
    },
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || "logs/user-service.log",
    maxFiles: 5,
    maxSize: "20m",
  },

  // Monitoring et Métriques
  monitoring: {
    healthcheck: {
      interval: 30000, // 30 secondes
      timeout: 5000, // 5 secondes
      retries: 3,
    },
  },

  // Session Management
  session: {
    maxActiveSessions: 5, // Max 5 sessions par utilisateur
    cleanupInterval: 60 * 60 * 1000, // Nettoyage toutes les heures
    extendOnActivity: true, // Étendre la session lors d'activité
  },

  // Features toggles
  features: {
    emailVerification: process.env.FEATURE_EMAIL_VERIFICATION === "true",
    socialLogin: process.env.FEATURE_SOCIAL_LOGIN === "true",
    passwordReset: process.env.FEATURE_PASSWORD_RESET !== "false",
    avatarUpload: process.env.FEATURE_AVATAR_UPLOAD !== "false",
    userDeletion: process.env.FEATURE_USER_DELETION !== "false",
  },
};

// Validation de la configuration
const validateConfig = () => {
  // Variables obligatoires en production
  if (config.env === "production") {
    const required = ["JWT_SECRET", "DATABASE_URL"];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }
  }

  // Validation de la force du secret JWT
  if (config.jwt.secret.length < 32) {
    console.warn("JWT secret should be at least 32 characters long");
  }

  // Validation de l'URL de base de données
  if (!config.database.url) {
    console.warn("Database URL not configured");
  }

  return true;
};

// Validation au démarrage (sauf en test)
if (config.env !== "test") {
  validateConfig();
}

module.exports = config;
