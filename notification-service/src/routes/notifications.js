const express = require("express");
const router = express.Router();
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");

// Get user notifications
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { unread_only, limit } = req.query;

    const notifications = await notificationService.getUserNotifications(
      userId,
      {
        unreadOnly: unread_only === "true",
        limit: parseInt(limit) || 50,
      }
    );

    res.json({ success: true, notifications, count: notifications.length });
  } catch (error) {
    logger.error("Error getting notifications:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

// Mark notification as read
router.patch("/:id/read", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const notification = await notificationService.markAsRead(
      req.params.id,
      userId
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ success: true, notification });
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Mark all notifications as read
router.post("/read-all", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await notificationService.markAllAsRead(userId);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

// Delete notification
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await notificationService.deleteNotification(req.params.id, userId);
    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    logger.error("Error deleting notification:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

// Send notification (internal API for other services)
router.post("/send", async (req, res) => {
  try {
    const {
      userId,
      type,
      title,
      message,
      metadata,
      userEmail,
      reviewTitle,
      reviewId,
    } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Handle different notification types with email
    switch (type) {
      case "review_created":
        await notificationService.handleReviewCreated(
          userId,
          userEmail,
          reviewTitle,
          reviewId
        );
        break;

      case "analysis_complete":
        await notificationService.handleAnalysisComplete(
          userId,
          userEmail,
          reviewTitle,
          reviewId
        );
        break;

      case "new_comment":
        await notificationService.handleNewComment(
          userId,
          userEmail,
          reviewTitle,
          metadata?.commenterName || "Someone",
          metadata?.comment || "",
          reviewId
        );
        break;

      case "status_changed":
        await notificationService.handleReviewStatusChanged(
          userId,
          reviewTitle,
          metadata?.oldStatus,
          metadata?.newStatus,
          reviewId
        );
        break;

      default:
        await notificationService.createNotification(
          userId,
          type,
          title,
          message,
          metadata
        );
    }

    res.json({ success: true, message: "Notification sent" });
  } catch (error) {
    logger.error("Error sending notification:", error);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

module.exports = router;
