const db = require("../db");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");
const { getPubClient } = require("../db/redis");
const websocketService = require("./websocketService");
const emailService = require("./emailService");

class NotificationService {
  async createNotification(userId, type, title, message, metadata = {}) {
    try {
      const result = await db.query(
        `INSERT INTO notifications (id, user_id, type, title, message, metadata, read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [
          uuidv4(),
          userId,
          type,
          title,
          message,
          JSON.stringify(metadata),
          false,
        ]
      );

      const notification = result.rows[0];

      // Send via WebSocket if user is connected
      websocketService.sendToUser(userId, {
        type: "notification",
        notification,
      });

      // Publish to Redis for other service instances
      const pubClient = getPubClient();
      if (pubClient) {
        await pubClient.publish(
          "notifications",
          JSON.stringify({
            userId,
            type: "notification",
            notification,
          })
        );
      }

      logger.info(`Notification created for user ${userId}: ${type}`);
      return notification;
    } catch (error) {
      logger.error("Error creating notification:", error);
      throw error;
    }
  }

  async getUserNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
    try {
      let query = `
        SELECT * FROM notifications
        WHERE user_id = $1
      `;
      const params = [userId];

      if (unreadOnly) {
        query += ` AND read = false`;
      }

      query += ` ORDER BY created_at DESC LIMIT $2`;
      params.push(limit);

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error("Error getting notifications:", error);
      throw error;
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      const result = await db.query(
        `UPDATE notifications 
         SET read = true, updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [notificationId, userId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error("Error marking notification as read:", error);
      throw error;
    }
  }

  async markAllAsRead(userId) {
    try {
      await db.query(
        `UPDATE notifications 
         SET read = true, updated_at = NOW()
         WHERE user_id = $1 AND read = false`,
        [userId]
      );

      logger.info(`All notifications marked as read for user ${userId}`);
    } catch (error) {
      logger.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  async deleteNotification(notificationId, userId) {
    try {
      await db.query(
        `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
        [notificationId, userId]
      );

      logger.info(`Notification ${notificationId} deleted`);
    } catch (error) {
      logger.error("Error deleting notification:", error);
      throw error;
    }
  }

  // Event handlers for different notification types
  async handleReviewCreated(userId, userEmail, reviewTitle, reviewId) {
    await this.createNotification(
      userId,
      "review_created",
      "Review Created",
      `Your code review "${reviewTitle}" has been created.`,
      { reviewId }
    );

    // Send email notification
    await emailService.sendReviewCreatedEmail(userEmail, reviewTitle);
  }

  async handleAnalysisComplete(userId, userEmail, reviewTitle, reviewId) {
    await this.createNotification(
      userId,
      "analysis_complete",
      "Analysis Complete",
      `AI analysis for "${reviewTitle}" is ready.`,
      { reviewId }
    );

    await emailService.sendAnalysisCompleteEmail(
      userEmail,
      reviewTitle,
      reviewId
    );
  }

  async handleNewComment(
    userId,
    userEmail,
    reviewTitle,
    commenterName,
    comment,
    reviewId
  ) {
    await this.createNotification(
      userId,
      "new_comment",
      "New Comment",
      `${commenterName} commented on "${reviewTitle}"`,
      { reviewId, comment }
    );

    await emailService.sendCommentNotification(
      userEmail,
      reviewTitle,
      commenterName,
      comment
    );
  }

  async handleReviewStatusChanged(
    userId,
    reviewTitle,
    oldStatus,
    newStatus,
    reviewId
  ) {
    await this.createNotification(
      userId,
      "status_changed",
      "Review Status Updated",
      `"${reviewTitle}" status changed from ${oldStatus} to ${newStatus}`,
      { reviewId, oldStatus, newStatus }
    );
  }
}

module.exports = new NotificationService();
