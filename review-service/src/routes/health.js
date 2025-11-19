const express = require("express");
const router = express.Router();
const codeAnalysisClient = require("../services/codeAnalysisClient");

router.get("/", async (req, res) => {
  try {
    const health = await codeAnalysisClient.checkHealth();

    res.json({
      status: "healthy",
      service: "review-service",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      dependencies: {
        codeAnalysisService: health,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      service: "review-service",
      error: error.message,
    });
  }
});

module.exports = router;
