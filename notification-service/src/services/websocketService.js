const WebSocket = require("ws");
const { getSubClient, getPubClient } = require("../db/redis");
const logger = require("../utils/logger");

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> WebSocket connection
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ server, path: "/ws" });

    this.wss.on("connection", (ws, req) => {
      logger.info("New WebSocket connection");

      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          logger.error("Invalid WebSocket message:", error);
        }
      });

      ws.on("close", () => {
        this.handleDisconnect(ws);
      });

      ws.on("error", (error) => {
        logger.error("WebSocket error:", error);
      });
    });

    // Heartbeat to detect broken connections
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    // Subscribe to Redis channels for cross-service notifications
    this.subscribeToRedis();

    logger.info("WebSocket server initialized");
  }

  handleMessage(ws, data) {
    const { type, userId, payload } = data;

    switch (type) {
      case "auth":
        // Associate WebSocket with user
        this.clients.set(userId, ws);
        ws.userId = userId;
        logger.info(`User ${userId} authenticated on WebSocket`);

        ws.send(
          JSON.stringify({
            type: "auth_success",
            message: "Connected to notification service",
          })
        );
        break;

      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;

      default:
        logger.warn(`Unknown message type: ${type}`);
    }
  }

  handleDisconnect(ws) {
    if (ws.userId) {
      this.clients.delete(ws.userId);
      logger.info(`User ${ws.userId} disconnected from WebSocket`);
    }
  }

  async subscribeToRedis() {
    const subClient = getSubClient();
    if (!subClient) {
      logger.warn("Redis subscriber not available");
      return;
    }

    // Subscribe to notification channel
    await subClient.subscribe("notifications", (message) => {
      try {
        const notification = JSON.parse(message);
        this.sendToUser(notification.userId, notification);
      } catch (error) {
        logger.error("Error processing Redis notification:", error);
      }
    });

    logger.info("Subscribed to Redis notifications channel");
  }

  sendToUser(userId, data) {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      logger.info(`Notification sent to user ${userId}`);
      return true;
    }
    return false;
  }

  broadcast(data) {
    let sent = 0;
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
        sent++;
      }
    });
    logger.info(`Broadcast sent to ${sent} clients`);
  }

  getConnectedUsers() {
    return Array.from(this.clients.keys());
  }

  getConnectionCount() {
    return this.clients.size;
  }
}

module.exports = new WebSocketService();
