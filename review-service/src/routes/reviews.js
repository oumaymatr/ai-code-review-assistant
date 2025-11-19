const express = require("express");
const router = express.Router();
const reviewService = require("../services/reviewService");
const codeAnalysisClient = require("../services/codeAnalysisClient");
const logger = require("../utils/logger");

// Create new review
router.post("/", async (req, res) => {
  try {
    const {
      code,
      language,
      title,
      description,
      auto_analyze = true,
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!code || !language || !title) {
      return res
        .status(400)
        .json({ error: "Missing required fields: code, language, title" });
    }

    // Create review
    const review = await reviewService.createReview(userId, {
      code,
      language,
      title,
      description,
    });

    // Trigger automatic analysis if requested
    if (auto_analyze) {
      // Run analysis asynchronously
      codeAnalysisClient
        .analyzeCode(code, language)
        .then((analysisResult) => {
          return reviewService.saveAnalysis(review.id, {
            provider: analysisResult.provider,
            analysis_type: analysisResult.analysis_type || "full",
            issues: analysisResult.issues || [],
            suggestions: analysisResult.summary?.raw_analysis || "",
            metrics: analysisResult.summary || {},
          });
        })
        .catch((err) => {
          logger.error(`Auto-analysis failed for review ${review.id}:`, err);
        });
    }

    res.status(201).json({
      success: true,
      review,
      message: auto_analyze
        ? "Review created, analysis in progress"
        : "Review created",
    });
  } catch (error) {
    logger.error("Error creating review:", error);
    res.status(500).json({ error: "Failed to create review" });
  }
});

// Get review by ID
router.get("/:id", async (req, res) => {
  try {
    const review = await reviewService.getReview(req.params.id);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    res.json({ success: true, review });
  } catch (error) {
    logger.error("Error getting review:", error);
    res.status(500).json({ error: "Failed to get review" });
  }
});

// List reviews
router.get("/", async (req, res) => {
  try {
    const { status, language, page, limit } = req.query;
    const userId = req.user?.id;

    const reviews = await reviewService.listReviews(userId, {
      status,
      language,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    res.json({ success: true, reviews, count: reviews.length });
  } catch (error) {
    logger.error("Error listing reviews:", error);
    res.status(500).json({ error: "Failed to list reviews" });
  }
});

// Update review status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const allowedStatuses = [
      "pending",
      "in_progress",
      "completed",
      "cancelled",
    ];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const review = await reviewService.updateReviewStatus(
      req.params.id,
      status,
      userId
    );
    res.json({ success: true, review });
  } catch (error) {
    logger.error("Error updating review status:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to update review status" });
  }
});

// Delete review
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await reviewService.deleteReview(req.params.id, userId);
    res.json({ success: true, message: "Review deleted" });
  } catch (error) {
    logger.error("Error deleting review:", error);
    res.status(500).json({ error: error.message || "Failed to delete review" });
  }
});

// Get review comments
router.get("/:id/comments", async (req, res) => {
  try {
    const comments = await reviewService.getComments(req.params.id);
    res.json({ success: true, comments, count: comments.length });
  } catch (error) {
    logger.error("Error getting comments:", error);
    res.status(500).json({ error: "Failed to get comments" });
  }
});

// Add comment to review
router.post("/:id/comments", async (req, res) => {
  try {
    const { content, line_number } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!content) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    const comment = await reviewService.addComment(
      req.params.id,
      userId,
      content,
      line_number || null
    );

    res.status(201).json({ success: true, comment });
  } catch (error) {
    logger.error("Error adding comment:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// Get review analyses
router.get("/:id/analyses", async (req, res) => {
  try {
    const analyses = await reviewService.getAnalyses(req.params.id);
    res.json({ success: true, analyses, count: analyses.length });
  } catch (error) {
    logger.error("Error getting analyses:", error);
    res.status(500).json({ error: "Failed to get analyses" });
  }
});

// Get generated tests for review
router.get("/:id/tests", async (req, res) => {
  try {
    const tests = await reviewService.getGeneratedTests(req.params.id);
    logger.info(`Retrieved ${tests.length} tests for review ${req.params.id}`);
    res.json({ success: true, tests, count: tests.length });
  } catch (error) {
    logger.error("Error getting generated tests:", error);
    res.status(500).json({ error: "Failed to get generated tests" });
  }
});

// Get optimizations for review
router.get("/:id/optimizations", async (req, res) => {
  try {
    const optimizations = await reviewService.getOptimizations(req.params.id);
    logger.info(
      `Returning ${optimizations.length} optimizations for review ${req.params.id}`
    );
    res.json({ success: true, optimizations, count: optimizations.length });
  } catch (error) {
    logger.error("Error getting optimizations:", error);
    res.status(500).json({ error: "Failed to get optimizations" });
  }
});

// Trigger code analysis
router.post("/:id/analyze", async (req, res) => {
  try {
    const { analysis_type = "full" } = req.body;

    // Get review
    const review = await reviewService.getReview(req.params.id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Trigger analysis asynchronously
    codeAnalysisClient
      .analyzeCode(review.code, review.language, analysis_type)
      .then((analysisResult) => {
        return reviewService.saveAnalysis(review.id, {
          provider: analysisResult.provider,
          analysis_type: analysisResult.analysis_type || analysis_type,
          issues: analysisResult.issues || [],
          suggestions: analysisResult.summary?.raw_analysis || "",
          metrics: analysisResult.summary || {},
        });
      })
      .catch((err) => {
        logger.error(`Analysis failed for review ${review.id}:`, err);
      });

    res.json({
      success: true,
      message: "Analysis started, results will be available shortly",
      analysis_type,
    });
  } catch (error) {
    logger.error("Error starting code analysis:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to start analysis" });
  }
});

// Generate tests for review
router.post("/:id/generate-tests", async (req, res) => {
  try {
    const { framework } = req.body;

    // Get review
    const review = await reviewService.getReview(req.params.id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Trigger test generation asynchronously (like analyze)
    codeAnalysisClient
      .generateTests(review.code, review.language, framework)
      .then((testResult) => {
        logger.info(`Test generation completed for review ${review.id}`);
        // Save generated tests to database
        return reviewService.saveGeneratedTests(review.id, {
          test_framework: framework || "jest",
          test_file_name: `${review.language}.test.js`,
          test_content: testResult.test_code || testResult.text || "",
          test_description: testResult.description || "AI generated unit tests",
          ai_model: testResult.provider || "ollama",
        });
      })
      .catch((err) => {
        logger.error(`Test generation failed for review ${review.id}:`, err);
      });

    res.json({
      success: true,
      message: "Test generation started, this may take a minute",
    });
  } catch (error) {
    logger.error("Error generating tests:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to generate tests" });
  }
});

// Optimize code for review
router.post("/:id/optimize", async (req, res) => {
  try {
    const { focus = "performance" } = req.body;

    // Get review
    const review = await reviewService.getReview(req.params.id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Trigger optimization asynchronously (like analyze)
    codeAnalysisClient
      .optimizeCode(review.code, review.language, focus)
      .then((optimizationResult) => {
        logger.info(`Code optimization completed for review ${review.id}`);
        // Save optimization to database
        return reviewService.saveOptimization(review.id, {
          optimization_type: focus,
          original_code: review.code,
          optimized_code:
            optimizationResult.optimized_code || optimizationResult.text || "",
          description: JSON.stringify(optimizationResult.changes || []),
          performance_impact:
            optimizationResult.impact?.estimated_improvement || "medium",
          ai_model: optimizationResult.provider || "ollama",
        });
      })
      .catch((err) => {
        logger.error(`Code optimization failed for review ${review.id}:`, err);
      });

    res.json({
      success: true,
      message: "Code optimization started, this may take a minute",
    });
  } catch (error) {
    logger.error("Error optimizing code:", error);
    res.status(500).json({ error: error.message || "Failed to optimize code" });
  }
});

module.exports = router;
