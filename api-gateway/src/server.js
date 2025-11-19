/**
 * API Gateway - Point d'entrée central pour AI Code Review Assistant
 *
 * Fonctionnalités:
 * - Authentification JWT
 * - Rate limiting intelligent
 * - Proxy routing vers microservices
 * - WebSocket pour notifications temps réel
 * - CORS et sécurité
 * - Logging structuré
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const config = require('./config/config');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// Import des routes
const healthRoutes = require('./routes/health');
const proxyRoutes = require('./routes/proxy');

const app = express();
const server = http.createServer(app);

// Configuration Socket.IO pour WebSocket
const io = socketIo(server, {
  cors: {
    origin: config.cors.origin,
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store Socket.IO instance pour l'utiliser dans d'autres modules
app.set('io', io);

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        styleSrc: ['\'self\'', '\'unsafe-inline\''],
        scriptSrc: ['\'self\''],
        connectSrc: ['\'self\'', 'ws://localhost:5000', 'http://localhost:5000']
      }
    }
  })
);

// Compression
app.use(compression());

// Logging
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  })
);

// CORS Configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
app.use(rateLimiter.general);

// Request ID et logging
app.use((req, res, next) => {
  req.id = require('uuid').v4();
  req.timestamp = new Date().toISOString();

  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: req.timestamp
  });

  next();
});

// Health Check (toujours accessible)
app.use('/health', healthRoutes);

// Routes d'API (proxy vers microservices)
app.use('/api', proxyRoutes);

// Route pour les métriques
app.get('/metrics', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: require('../package.json').version,
    environment: process.env.NODE_ENV,
    services: {
      userService: config.services.userService,
      reviewService: config.services.reviewService,
      codeAnalysisService: config.services.codeAnalysisService,
      notificationService: config.services.notificationService
    }
  });
});

// WebSocket Connection Handling
io.on('connection', (socket) => {
  logger.info('Client connected via WebSocket', { socketId: socket.id });

  // Authentification WebSocket
  socket.on('authenticate', async (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.userId = decoded.userId;
      socket.join(`user_${decoded.userId}`);

      socket.emit('authenticated', {
        success: true,
        userId: decoded.userId
      });

      logger.info('Socket authenticated', {
        socketId: socket.id,
        userId: decoded.userId
      });
    } catch (error) {
      socket.emit('authentication_error', {
        error: 'Invalid token'
      });
      logger.warn('Socket authentication failed', {
        socketId: socket.id,
        error: error.message
      });
    }
  });

  // Gestion des déconnexions
  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });

  // Gestion des erreurs WebSocket
  socket.on('error', (error) => {
    logger.error('WebSocket error', {
      socketId: socket.id,
      error: error.message
    });
  });
});

// Route 404 pour les routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    timestamp: new Date().toISOString()
  });
});

// Error Handler global
app.use(errorHandler);

// Démarrage du serveur
const PORT = config.port || 5000;

server.listen(PORT, '0.0.0.0', () => {
  logger.info('API Gateway started successfully', {
    port: PORT,
    environment: config.env,
    nodeVersion: process.version,
    processId: process.pid,
    services: {
      userService: config.services.userService,
      reviewService: config.services.reviewService,
      codeAnalysisService: config.services.codeAnalysisService,
      notificationService: config.services.notificationService
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = app;
