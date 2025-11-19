const nodemailer = require("nodemailer");
const config = require("../config");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.transporter = null;
    this.enabled = config.email.enabled;

    if (this.enabled && config.email.user && config.email.password) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.password,
        },
      });

      logger.info("Email service initialized");
    } else {
      logger.warn("Email service disabled (missing configuration)");
    }
  }

  async sendEmail({ to, subject, text, html }) {
    if (!this.enabled || !this.transporter) {
      logger.warn("Email not sent (service disabled)");
      return { success: false, reason: "Email service disabled" };
    }

    try {
      const info = await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        text,
        html,
      });

      logger.info(`Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error("Email send failed:", error);
      return { success: false, error: error.message };
    }
  }

  async sendReviewCreatedEmail(userEmail, reviewTitle) {
    return this.sendEmail({
      to: userEmail,
      subject: "New Code Review Created",
      text: `Your code review "${reviewTitle}" has been created and is being processed.`,
      html: `
        <h2>Code Review Created</h2>
        <p>Your code review <strong>"${reviewTitle}"</strong> has been created successfully.</p>
        <p>Our AI is analyzing your code. You'll receive notifications when the analysis is complete.</p>
      `,
    });
  }

  async sendAnalysisCompleteEmail(userEmail, reviewTitle, reviewId) {
    return this.sendEmail({
      to: userEmail,
      subject: "Code Analysis Complete",
      text: `Analysis complete for "${reviewTitle}". View results now.`,
      html: `
        <h2>Analysis Complete</h2>
        <p>The AI analysis for your code review <strong>"${reviewTitle}"</strong> is complete.</p>
        <p><a href="${
          process.env.APP_URL || "http://localhost:3000"
        }/review/${reviewId}">View Results</a></p>
      `,
    });
  }

  async sendCommentNotification(
    userEmail,
    reviewTitle,
    commenterName,
    comment
  ) {
    return this.sendEmail({
      to: userEmail,
      subject: `New Comment on "${reviewTitle}"`,
      text: `${commenterName} commented: ${comment}`,
      html: `
        <h2>New Comment</h2>
        <p><strong>${commenterName}</strong> commented on your code review <strong>"${reviewTitle}"</strong>:</p>
        <blockquote>${comment}</blockquote>
      `,
    });
  }
}

module.exports = new EmailService();
