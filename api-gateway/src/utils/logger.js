/**
 * Logger centralisé avec Winston
 */

const winston = require("winston");
const path = require("path");
const config = require("../config/config");

// Format personnalisé pour les logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Ajouter les métadonnées si présentes
    if (Object.keys(meta).length > 0) {
      logMessage += ` | ${JSON.stringify(meta)}`;
    }

    return logMessage;
  })
);

// Configuration des transports
const transports = [
  // Console output (toujours actif)
  new winston.transports.Console({
    level: config.logging.level,
    format: winston.format.combine(winston.format.colorize(), customFormat),
  }),
];

// Fichier de log si configuré
if (config.logging.file) {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), config.logging.file),
      level: config.logging.level,
      format: customFormat,
      maxsize: config.logging.maxSize || "20m",
      maxFiles: config.logging.maxFiles || 5,
    })
  );
}

// Fichier d'erreur séparé
transports.push(
  new winston.transports.File({
    filename: path.join(process.cwd(), "logs/error.log"),
    level: "error",
    format: customFormat,
    maxsize: "10m",
    maxFiles: 3,
  })
);

// Créer le logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  transports,

  // Ne pas sortir sur console si on n'est pas en développement
  silent: process.env.NODE_ENV === "test",

  // Gestion des exceptions non capturées
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs/exceptions.log"),
    }),
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs/rejections.log"),
    }),
  ],
});

// Helper methods pour différents types de logs
const logMethods = {
  // Log d'authentification
  auth: (message, meta = {}) => {
    logger.info(message, {
      category: "AUTH",
      ...meta,
    });
  },

  // Log de proxy/routing
  proxy: (message, meta = {}) => {
    logger.info(message, {
      category: "PROXY",
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

  // Log de performance
  performance: (message, meta = {}) => {
    logger.info(message, {
      category: "PERFORMANCE",
      ...meta,
    });
  },

  // Log d'API calls
  api: (message, meta = {}) => {
    logger.info(message, {
      category: "API",
      ...meta,
    });
  },

  // Log de WebSocket
  websocket: (message, meta = {}) => {
    logger.info(message, {
      category: "WEBSOCKET",
      ...meta,
    });
  },
};

// Ajouter les méthodes helper au logger
Object.assign(logger, logMethods);

// Export du logger avec méthodes supplémentaires
module.exports = logger;
