/**
 * Configuration centralisée pour API Gateway
 */

const config = {
  // Environnement
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-123',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: '7d'
  },

  // Database
  database: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres123@postgres:5432/ai_code_review_dev'
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://redis:6379',
    prefix: 'ai-review:',
    ttl: {
      session: 24 * 60 * 60, // 24 hours
      rateLimit: 15 * 60, // 15 minutes
      cache: 60 * 60 // 1 hour
    }
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://frontend:3000'
    ]
  },

  // Rate Limiting
  rateLimiting: {
    windowMs:
      parseInt(process.env.RATE_LIMIT_WINDOW, 10) * 60 * 1000 || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 50000, // 50k requêtes pour supporter le polling intensif

    // Rate limits spécialisés
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10000 // 10k tentatives en dev
    },

    upload: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 50 // 50 uploads par minute
    },

    analysis: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 1000 // 1000 analyses par 5 minutes (polling + vraies requêtes)
    }
  },

  // Services URLs
  services: {
    userService: process.env.USER_SERVICE_URL || 'http://user-service:5001',
    reviewService:
      process.env.REVIEW_SERVICE_URL || 'http://review-service:5002',
    codeAnalysisService:
      process.env.CODE_ANALYSIS_SERVICE_URL ||
      'http://code-analysis-service:5003',
    notificationService:
      process.env.NOTIFICATION_SERVICE_URL ||
      'http://notification-service:5004'
  },

  // Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
    allowedTypes: (
      process.env.ALLOWED_FILE_TYPES ||
      '.js,.ts,.py,.java,.cpp,.c,.cs,.php,.rb,.go,.rs,.jsx,.tsx,.vue,.html,.css,.scss,.less,.sql,.sh,.yaml,.yml,.json,.xml,.md'
    ).split(','),
    uploadPath: '/app/uploads'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || null,
    maxFiles: 5,
    maxSize: '20m'
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    maxFailedAttempts: 5,
    lockoutTime: 15 * 60 * 1000 // 15 minutes
  },

  // AI Configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      maxTokens: 2048,
      temperature: 0.3
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
      models: {
        codeAnalysis: 'codellama:7b',
        general: 'llama2:7b',
        fast: 'phi:2.7b'
      }
    }
  },

  // Monitoring
  monitoring: {
    healthcheck: {
      interval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      retries: 3
    },
    metrics: {
      enabled: true,
      endpoint: '/metrics'
    }
  }
};

// Validation de la configuration
const validateConfig = () => {
  const required = ['JWT_SECRET'];
  const missing = required.filter(
    (key) => !process.env[key] && config.env === 'production'
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
  return true;
};

// Validation au démarrage
if (config.env !== 'test') {
  validateConfig();
}

module.exports = config;
