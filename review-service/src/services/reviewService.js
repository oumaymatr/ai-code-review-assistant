const db = require("../db");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

class ReviewService {
  async createReview(userId, data) {
    const { code, language, title, description } = data;

    try {
      const result = await db.query(
        `INSERT INTO reviews (id, user_id, title, description, code, language, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          uuidv4(),
          userId,
          title,
          description || null,
          code,
          language,
          "pending",
        ]
      );

      logger.info(`Review created: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating review:", error);
      throw error;
    }
  }

  async getReview(reviewId) {
    try {
      const result = await db.query(
        `SELECT r.*, u.username, u.email,
                COUNT(DISTINCT c.id) as comment_count,
                COUNT(DISTINCT a.id) as analysis_count
         FROM reviews r
         LEFT JOIN users u ON r.user_id = u.id
         LEFT JOIN review_comments c ON r.id = c.review_id
         LEFT JOIN code_analyses a ON r.id = a.review_id
         WHERE r.id = $1
         GROUP BY r.id, u.username, u.email`,
        [reviewId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error("Error getting review:", error);
      throw error;
    }
  }

  async listReviews(userId, filters = {}) {
    const { status, language, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT r.*, u.username,
             COUNT(DISTINCT c.id) as comment_count
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN review_comments c ON r.id = c.review_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND r.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (language) {
      query += ` AND r.language = $${paramIndex}`;
      params.push(language);
      paramIndex++;
    }

    query += ` GROUP BY r.id, u.username ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${
      paramIndex + 1
    }`;
    params.push(limit, offset);

    try {
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error("Error listing reviews:", error);
      throw error;
    }
  }

  async updateReviewStatus(reviewId, status, userId) {
    try {
      const result = await db.query(
        `UPDATE reviews 
         SET status = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [status, reviewId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error("Review not found or unauthorized");
      }

      logger.info(`Review ${reviewId} status updated to ${status}`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error updating review status:", error);
      throw error;
    }
  }

  async deleteReview(reviewId, userId) {
    try {
      const result = await db.query(
        `DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING id`,
        [reviewId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error("Review not found or unauthorized");
      }

      logger.info(`Review deleted: ${reviewId}`);
      return true;
    } catch (error) {
      logger.error("Error deleting review:", error);
      throw error;
    }
  }

  async addComment(reviewId, userId, content, lineNumber = null) {
    try {
      const result = await db.query(
        `INSERT INTO review_comments (id, review_id, user_id, content, line_number, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [uuidv4(), reviewId, userId, content, lineNumber]
      );

      logger.info(`Comment added to review ${reviewId}`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error adding comment:", error);
      throw error;
    }
  }

  async getComments(reviewId) {
    try {
      const result = await db.query(
        `SELECT c.*, u.username, u.email
         FROM review_comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.review_id = $1
         ORDER BY c.created_at ASC`,
        [reviewId]
      );

      return result.rows;
    } catch (error) {
      logger.error("Error getting comments:", error);
      throw error;
    }
  }

  async saveAnalysis(reviewId, analysisData) {
    const { provider, analysis_type, issues, suggestions, metrics } =
      analysisData;

    try {
      // Combine all analysis data into the result JSONB column as per schema
      const resultData = {
        provider,
        analysis_type: analysis_type || "full",
        issues: issues || [],
        suggestions: suggestions || [],
        metrics: metrics || {},
      };

      const result = await db.query(
        `INSERT INTO code_analyses (id, review_id, analysis_type, result, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [
          uuidv4(),
          reviewId,
          analysis_type || "full",
          JSON.stringify(resultData),
        ]
      );

      logger.info(`Analysis saved for review ${reviewId}`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error saving analysis:", error);
      throw error;
    }
  }

  async getAnalyses(reviewId) {
    try {
      const result = await db.query(
        `SELECT * FROM code_analyses
         WHERE review_id = $1
         ORDER BY created_at DESC`,
        [reviewId]
      );

      return result.rows;
    } catch (error) {
      logger.error("Error getting analyses:", error);
      throw error;
    }
  }

  async saveGeneratedTests(reviewId, testsData) {
    const {
      test_framework,
      test_file_name,
      test_content,
      test_description,
      ai_model,
    } = testsData;

    try {
      const result = await db.query(
        `INSERT INTO generated_tests (id, review_id, test_framework, test_file_name, test_content, test_description, ai_model, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [
          uuidv4(),
          reviewId,
          test_framework || "jest",
          test_file_name || "generated.test.js",
          test_content,
          test_description || "",
          ai_model || "ollama",
        ]
      );

      logger.info(`Generated tests saved for review ${reviewId}`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error saving generated tests:", error);
      throw error;
    }
  }

  async getGeneratedTests(reviewId) {
    try {
      const result = await db.query(
        `SELECT 
          id,
          review_id,
          test_framework as framework,
          test_file_name,
          test_content as test_code,
          test_description as description,
          'unit' as test_type,
          ai_model,
          created_at
         FROM generated_tests
         WHERE review_id = $1
         ORDER BY created_at DESC`,
        [reviewId]
      );

      logger.info(
        `Retrieved ${result.rows.length} tests for review ${reviewId}`
      );
      return result.rows;
    } catch (error) {
      logger.error("Error getting generated tests:", error);
      throw error;
    }
  }

  async saveOptimization(reviewId, optimizationData) {
    const {
      optimization_type,
      original_code,
      optimized_code,
      description,
      performance_impact,
      ai_model,
    } = optimizationData;

    try {
      const result = await db.query(
        `INSERT INTO code_optimizations (id, review_id, optimization_type, original_code, optimized_code, description, performance_impact, ai_model, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING *`,
        [
          uuidv4(),
          reviewId,
          optimization_type || "performance",
          original_code,
          optimized_code,
          description || "",
          performance_impact || "medium",
          ai_model || "ollama",
        ]
      );

      logger.info(`Code optimization saved for review ${reviewId}`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error saving optimization:", error);
      throw error;
    }
  }

  async getOptimizations(reviewId) {
    try {
      const result = await db.query(
        `SELECT * FROM code_optimizations
         WHERE review_id = $1
         ORDER BY created_at DESC`,
        [reviewId]
      );

      logger.info(
        `Retrieved ${result.rows.length} optimizations for review ${reviewId}`
      );
      return result.rows;
    } catch (error) {
      logger.error("Error getting optimizations:", error);
      throw error;
    }
  }
}

module.exports = new ReviewService();
