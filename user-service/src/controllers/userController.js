/**
 * Contrôleur de gestion utilisateur - User Service
 */

const User = require("../models/User");
const {
  validatePasswordStrength,
  validateEmail,
  validateAvatarFile,
} = require("../utils/validation");
const logger = require("../utils/logger");
const { redisClient } = require("../config/database");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

class UserController {
  /**
   * Mettre à jour le profil utilisateur
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { full_name, email, avatar_url } = req.body;

      // 1. Récupérer l'utilisateur actuel
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // 2. Préparer les données de mise à jour
      const updateData = {};

      // Nom complet
      if (full_name !== undefined) {
        updateData.full_name = full_name;
      }

      // Email (vérifier l'unicité)
      if (email && email !== user.email) {
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: "Invalid email format",
            details: emailValidation.checks,
          });
        }

        const existingUser = await User.findByEmail(emailValidation.normalized);
        if (existingUser && existingUser.id !== userId) {
          return res.status(409).json({
            success: false,
            error: "Email already in use",
            message:
              "This email address is already associated with another account",
          });
        }

        updateData.email = emailValidation.normalized;
        updateData.email_verified = false; // Reset email verification
      }

      // Avatar URL
      if (avatar_url !== undefined) {
        updateData.avatar_url = avatar_url;
      }

      // 3. Effectuer la mise à jour
      const updatedUser = await user.updateProfile(updateData);

      // 4. Logger l'événement
      logger.info("User profile updated", {
        userId,
        updatedFields: Object.keys(updateData),
        ip: req.ip,
      });

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
          user: updatedUser.toJSON(),
        },
      });
    } catch (error) {
      logger.error("Update profile error", {
        error: error.message,
        userId: req.user?.id,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: "Profile update failed",
        message: "An unexpected error occurred while updating profile",
      });
    }
  }

  /**
   * Changer le mot de passe
   */
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      // 1. Récupérer l'utilisateur
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // 2. Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await user.verifyPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid current password",
          message: "The current password you entered is incorrect",
        });
      }

      // 3. Valider le nouveau mot de passe
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Password does not meet security requirements",
          details: passwordValidation.checks,
          strength: passwordValidation.strength,
        });
      }

      // 4. Vérifier que le nouveau mot de passe est différent
      const isSamePassword = await bcrypt.compare(
        newPassword,
        user.password_hash
      );
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          error: "Same password",
          message:
            "The new password must be different from your current password",
        });
      }

      // 5. Hasher et sauvegarder le nouveau mot de passe
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      await user.updateProfile({
        password_hash: newPasswordHash,
        password_changed_at: new Date(),
      });

      // 6. Invalider toutes les sessions existantes
      await this.invalidateAllUserSessions(userId);

      // 7. Logger l'événement
      logger.security("Password changed", {
        userId,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        passwordStrength: passwordValidation.strength,
      });

      res.json({
        success: true,
        message: "Password changed successfully. Please log in again.",
      });
    } catch (error) {
      logger.error("Change password error", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Password change failed",
        message: "An unexpected error occurred while changing password",
      });
    }
  }

  /**
   * Demander une réinitialisation de mot de passe
   */
  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;

      // 1. Trouver l'utilisateur
      const user = await User.findByEmail(email);
      if (!user) {
        // Ne pas révéler si l'email existe ou non
        return res.json({
          success: true,
          message:
            "If an account with that email exists, you will receive a password reset link",
        });
      }

      // 2. Générer un token de réinitialisation
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
      const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // 3. Sauvegarder le token en base
      await user.updateProfile({
        reset_token_hash: resetTokenHash,
        reset_token_expires: resetTokenExpires,
      });

      // 4. Stocker aussi en Redis pour une double sécurité
      await redisClient.setex(
        `password_reset:${resetTokenHash}`,
        10 * 60, // 10 minutes
        JSON.stringify({
          userId: user.id,
          email: user.email,
          createdAt: new Date().toISOString(),
        })
      );

      // 5. Logger l'événement
      logger.security("Password reset requested", {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      // 6. En production, ici on enverrait un email avec le token
      // Pour le développement, on peut retourner le token
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      if (process.env.NODE_ENV === "development") {
        res.json({
          success: true,
          message: "Password reset link generated",
          data: {
            resetUrl,
            token: resetToken,
            expiresIn: "10 minutes",
          },
        });
      } else {
        res.json({
          success: true,
          message:
            "If an account with that email exists, you will receive a password reset link",
        });
      }
    } catch (error) {
      logger.error("Password reset request error", {
        error: error.message,
        email: req.body?.email,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: "Password reset request failed",
        message: "An unexpected error occurred while processing your request",
      });
    }
  }

  /**
   * Confirmer la réinitialisation de mot de passe
   */
  async confirmPasswordReset(req, res) {
    try {
      const { token, newPassword } = req.body;

      // 1. Hasher le token reçu
      const resetTokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      // 2. Vérifier le token en Redis
      const tokenData = await redisClient.get(
        `password_reset:${resetTokenHash}`
      );
      if (!tokenData) {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired reset token",
          message: "The password reset token is invalid or has expired",
        });
      }

      const { userId, email } = JSON.parse(tokenData);

      // 3. Récupérer l'utilisateur et vérifier le token
      const user = await User.findById(userId);
      if (
        !user ||
        user.reset_token_hash !== resetTokenHash ||
        user.reset_token_expires < new Date()
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired reset token",
          message: "The password reset token is invalid or has expired",
        });
      }

      // 4. Valider le nouveau mot de passe
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Password does not meet security requirements",
          details: passwordValidation.checks,
          strength: passwordValidation.strength,
        });
      }

      // 5. Hasher et sauvegarder le nouveau mot de passe
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      await user.updateProfile({
        password_hash: newPasswordHash,
        password_changed_at: new Date(),
        reset_token_hash: null,
        reset_token_expires: null,
      });

      // 6. Supprimer le token de Redis
      await redisClient.del(`password_reset:${resetTokenHash}`);

      // 7. Invalider toutes les sessions existantes
      await this.invalidateAllUserSessions(userId);

      // 8. Logger l'événement
      logger.security("Password reset completed", {
        userId,
        email,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        passwordStrength: passwordValidation.strength,
      });

      res.json({
        success: true,
        message:
          "Password reset successfully. Please log in with your new password.",
      });
    } catch (error) {
      logger.error("Password reset confirmation error", {
        error: error.message,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: "Password reset failed",
        message: "An unexpected error occurred while resetting password",
      });
    }
  }

  /**
   * Supprimer le compte utilisateur
   */
  async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      const { password, confirmDeletion } = req.body;

      if (!confirmDeletion) {
        return res.status(400).json({
          success: false,
          error: "Deletion not confirmed",
          message: "You must confirm account deletion",
        });
      }

      // 1. Récupérer l'utilisateur
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // 2. Vérifier le mot de passe
      const isPasswordValid = await user.verifyPassword(password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid password",
          message:
            "Please enter your current password to confirm account deletion",
        });
      }

      // 3. Marquer le compte comme supprimé (soft delete)
      await user.updateProfile({
        is_active: false,
        deleted_at: new Date(),
        email: `deleted_${Date.now()}_${user.email}`, // Éviter les conflits d'email
      });

      // 4. Invalider toutes les sessions
      await this.invalidateAllUserSessions(userId);

      // 5. Logger l'événement
      logger.security("Account deleted", {
        userId,
        email: user.email,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      logger.error("Delete account error", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Account deletion failed",
        message: "An unexpected error occurred while deleting account",
      });
    }
  }

  /**
   * Obtenir les sessions actives
   */
  async getActiveSessions(req, res) {
    try {
      const userId = req.user.id;

      // Récupérer toutes les sessions de l'utilisateur depuis Redis
      const pattern = `session:*`;
      const keys = await redisClient.keys(pattern);
      const sessions = [];

      for (const key of keys) {
        const sessionData = await redisClient.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.user_id === userId) {
            sessions.push({
              id: key.replace("session:", ""),
              ip_address: session.ip_address,
              user_agent: session.user_agent,
              created_at: session.created_at,
              expires_at: session.expires_at,
              is_current: key.includes(
                req.token
                  ? crypto.createHash("sha256").update(req.token).digest("hex")
                  : ""
              ),
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          sessions: sessions.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          ),
        },
      });
    } catch (error) {
      logger.error("Get active sessions error", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to fetch sessions",
        message: "An unexpected error occurred while fetching active sessions",
      });
    }
  }

  /**
   * Révoquer une session spécifique
   */
  async revokeSession(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;

      // Supprimer la session spécifique
      await redisClient.del(`session:${sessionId}`);

      logger.info("Session revoked", {
        userId,
        sessionId,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: "Session revoked successfully",
      });
    } catch (error) {
      logger.error("Revoke session error", {
        error: error.message,
        userId: req.user?.id,
        sessionId: req.params?.sessionId,
      });

      res.status(500).json({
        success: false,
        error: "Failed to revoke session",
        message: "An unexpected error occurred while revoking session",
      });
    }
  }

  /**
   * Helper: Invalider toutes les sessions d'un utilisateur
   */
  async invalidateAllUserSessions(userId) {
    try {
      // Supprimer toutes les sessions
      const pattern = `session:*`;
      const keys = await redisClient.keys(pattern);

      for (const key of keys) {
        const sessionData = await redisClient.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.user_id === userId) {
            await redisClient.del(key);
          }
        }
      }

      // Supprimer le refresh token
      await redisClient.del(`refresh_token:${userId}`);
    } catch (error) {
      logger.error("Invalidate all user sessions error", {
        error: error.message,
        userId,
      });
    }
  }
}

module.exports = new UserController();
