/**
 * Logger pour User Service
 */

const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Utiliser des valeurs par défaut si config n'est pas disponible
let config;
try {
  config = require("../config/config");
} catch (error) {
  config = {
    logging: {
      level: process.env.LOG_LEVEL || "info",
      file: null, // Désactiver les fichiers si erreur
    },
    env: process.env.NODE_ENV || "development",
  };
}

// Format personnalisé
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(
    ({ timestamp, level, message, service = "user-service", ...meta }) => {
      let logMessage = `${timestamp} [${level.toUpperCase()}] [${service}]: ${message}`;

      if (Object.keys(meta).length > 0) {
        logMessage += ` | ${JSON.stringify(meta)}`;
      }

      return logMessage;
    }
  )
);

// Configuration des transports
const transports = [
  new winston.transports.Console({
    level: config.logging.level,
    format: winston.format.combine(winston.format.colorize(), customFormat),
  }),
];

// Fichier de log principal
if (config.logging.file) {
  try {
    // Créer le répertoire logs s'il n'existe pas
    const logDir = path.dirname(config.logging.file);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    transports.push(
      new winston.transports.File({
        filename: path.join(process.cwd(), config.logging.file),
        level: config.logging.level,
        format: customFormat,
        maxsize: config.logging.maxSize || "20m",
        maxFiles: config.logging.maxFiles || 5,
      })
    );
  } catch (error) {
    console.warn("Failed to create log file transport:", error.message);
  }
}

// Fichier d'erreur séparé - avec gestion d'erreur
try {
  const logDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, "user-service-error.log"),
      level: "error",
      format: customFormat,
      maxsize: "10m",
      maxFiles: 3,
    })
  );
} catch (error) {
  console.warn("Failed to create error log file transport:", error.message);
}

// Créer le logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  defaultMeta: { service: "user-service" },
  transports,

  silent: process.env.NODE_ENV === "test",

  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs/user-service-exceptions.log"),
    }),
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs/user-service-rejections.log"),
    }),
  ],
});

// Helper methods spécialisés pour User Service
const logMethods = {
  // Log d'authentification
  auth: (message, meta = {}) => {
    logger.info(message, {
      category: "AUTH",
      ...meta,
    });
  },

  // Log de création d'utilisateur
  userCreation: (message, meta = {}) => {
    logger.info(message, {
      category: "USER_CREATION",
      ...meta,
    });
  },

  // Log de sécurité
  security: (message, meta = {}) => {
    logger.warn(message, {
      category: "SECURITY",
      ...meta,
    });
  },

  // Log de base de données
  database: (message, meta = {}) => {
    logger.info(message, {
      category: "DATABASE",
      ...meta,
    });
  },

  // Log de validation
  validation: (message, meta = {}) => {
    logger.warn(message, {
      category: "VALIDATION",
      ...meta,
    });
  },

  // Log d'audit pour les actions sensibles
  audit: (message, meta = {}) => {
    logger.info(message, {
      category: "AUDIT",
      ...meta,
    });
  },
};

// Ajouter les méthodes au logger
Object.assign(logger, logMethods);

module.exports = logger;
