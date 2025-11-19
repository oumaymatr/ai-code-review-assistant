const express = require("express");
const router = express.Router();
const websocketService = require("../services/websocketService");

router.get("/", (req, res) => {
  res.json({
    status: "healthy",
    service: "notification-service",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    websocket: {
      connected_users: websocketService.getConnectionCount(),
    },
  });
});

module.exports = router;
