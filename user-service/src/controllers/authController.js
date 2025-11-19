/**
 * Contrôleur d'authentification - User Service
 */

const User = require("../models/User");
const {
  validatePasswordStrength,
  validateEmail,
  validateUsername,
} = require("../utils/validation");
const logger = require("../utils/logger");
const { redisClient } = require("../config/database");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

class AuthController {
  constructor() {
    // Bind all methods to preserve 'this' context
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
  }

  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(req, res) {
    try {
      const { email, username, password, full_name } = req.body;

      // 1. Validations supplémentaires
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid email format",
          details: emailValidation.checks,
        });
      }

      const usernameValidation = validateUsername(username);
      if (!usernameValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid username format",
          details: usernameValidation.checks,
        });
      }

      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Password does not meet security requirements",
          details: passwordValidation.checks,
          strength: passwordValidation.strength,
        });
      }

      // 2. Vérifier si l'utilisateur existe déjà
      const existingUserByEmail = await User.findByEmail(
        emailValidation.normalized
      );
      if (existingUserByEmail) {
        return res.status(409).json({
          success: false,
          error: "User already exists",
          message: "An account with this email address already exists",
        });
      }

      const existingUserByUsername = await User.findByUsername(
        usernameValidation.normalized
      );
      if (existingUserByUsername) {
        return res.status(409).json({
          success: false,
          error: "Username taken",
          message: "This username is already taken",
        });
      }

      // 3. Créer le nouvel utilisateur
      const userData = {
        email: emailValidation.normalized,
        username: usernameValidation.normalized,
        password,
        full_name: full_name || null,
      };

      const user = await User.create(userData);

      // 4. Générer le token JWT
      const token = user.generateJWT();
      const refreshToken = user.generateRefreshToken();

      // 5. Stocker le refresh token en Redis
      await redisClient.set(`refresh_token:${user.id}`, refreshToken, {
        EX: 7 * 24 * 60 * 60, // 7 jours
      });

      // 6. Logger l'événement
      logger.info("User registered successfully", {
        userId: user.id,
        email: user.email,
        username: user.username,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      // 7. Réponse de succès
      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: user.toPublicJSON(),
          tokens: {
            accessToken: token,
            refreshToken,
            expiresIn: "24h",
          },
        },
      });
    } catch (error) {
      logger.error("Registration error", {
        error: error.message,
        stack: error.stack,
        body: req.body,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: "Registration failed",
        message: "An unexpected error occurred during registration",
      });
    }
  }

  /**
   * Connexion utilisateur
   */
  async login(req, res) {
    try {
      const { email, password, rememberMe } = req.body;

      // 1. Trouver l'utilisateur
      const user = await User.findByEmail(email);
      if (!user) {
        logger.auth("Login attempt with non-existent email", { email });
        return res.status(401).json({
          success: false,
          error: "USER_NOT_FOUND",
          message:
            "No account found with this email address. Please check your email or sign up.",
        });
      }

      // 2. Vérifier si le compte est actif
      if (!user.is_active) {
        logger.security("Login attempt on disabled account", {
          userId: user.id,
          email,
        });
        return res.status(403).json({
          success: false,
          error: "ACCOUNT_DISABLED",
          message:
            "Your account has been disabled. Please contact support at support@aicodereviewer.com",
        });
      }

      // 3. Vérifier le mot de passe
      const isPasswordValid = await user.verifyPassword(password);
      if (!isPasswordValid) {
        // Incrémenter le compteur de tentatives échouées
        await this.incrementFailedAttempts(user.id, req.ip);

        logger.security("Failed login attempt - incorrect password", {
          userId: user.id,
          email,
          ip: req.ip,
        });
        return res.status(401).json({
          success: false,
          error: "INCORRECT_PASSWORD",
          message: "Incorrect password. Please try again.",
        });
      }

      // 4. Réinitialiser les tentatives échouées
      await this.resetFailedAttempts(user.id, req.ip);

      // 5. Générer les tokens
      const tokenExpiry = rememberMe ? "7d" : "24h";
      const token = user.generateJWT(tokenExpiry);
      const refreshToken = user.generateRefreshToken();

      // 6. Stocker le refresh token
      const refreshTokenExpiry = rememberMe
        ? 30 * 24 * 60 * 60
        : 7 * 24 * 60 * 60; // 30 jours ou 7 jours
      await redisClient.set(`refresh_token:${user.id}`, refreshToken, {
        EX: refreshTokenExpiry,
      });

      // 7. Mettre à jour le last_login
      await user.updateLastLogin();

      // 8. Créer une session
      await this.createSession(user.id, req.ip, req.get("User-Agent"), token);

      // 9. Logger l'événement
      logger.info("User logged in successfully", {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        rememberMe,
      });

      // 10. Réponse de succès
      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: user.toPublicJSON(),
          tokens: {
            accessToken: token,
            refreshToken,
            expiresIn: tokenExpiry,
          },
        },
      });
    } catch (error) {
      logger.error("Login error", {
        error: error.message,
        stack: error.stack,
        email: req.body?.email,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: "SERVER_ERROR",
        message:
          "We're experiencing technical difficulties. Please try again in a few moments.",
      });
    }
  }

  /**
   * Déconnexion utilisateur
   */
  async logout(req, res) {
    try {
      const userId = req.user.id;
      const token = req.token;

      // 1. Supprimer le refresh token de Redis
      await redisClient.del(`refresh_token:${userId}`);

      // 2. Blacklister le token actuel
      await redisClient.setex(
        `blacklisted_token:${token}`,
        24 * 60 * 60,
        "true"
      ); // 24h

      // 3. Supprimer toutes les sessions actives
      await this.removeUserSessions(userId);

      // 4. Logger l'événement
      logger.info("User logged out successfully", {
        userId,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      logger.error("Logout error", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: "Logout failed",
        message: "An unexpected error occurred during logout",
      });
    }
  }

  /**
   * Renouveler le token d'accès
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: "Missing refresh token",
          message: "Refresh token is required",
        });
      }

      // 1. Vérifier le refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: "Invalid refresh token",
          message: "The refresh token is invalid or expired",
        });
      }

      // 2. Vérifier que le token existe en Redis
      const storedToken = await redisClient.get(
        `refresh_token:${decoded.userId}`
      );
      if (!storedToken || storedToken !== refreshToken) {
        return res.status(401).json({
          success: false,
          error: "Invalid refresh token",
          message: "The refresh token is not valid",
        });
      }

      // 3. Récupérer l'utilisateur
      const user = await User.findById(decoded.userId);
      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          error: "User not found or inactive",
          message: "The user associated with this token is not valid",
        });
      }

      // 4. Générer un nouveau token d'accès
      const newAccessToken = user.generateJWT();

      // 5. Optionnellement générer un nouveau refresh token
      const newRefreshToken = user.generateRefreshToken();
      await redisClient.setex(
        `refresh_token:${user.id}`,
        7 * 24 * 60 * 60,
        newRefreshToken
      );

      res.json({
        success: true,
        message: "Tokens refreshed successfully",
        data: {
          tokens: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: "24h",
          },
        },
      });
    } catch (error) {
      logger.error("Token refresh error", {
        error: error.message,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: "Token refresh failed",
        message: "An unexpected error occurred while refreshing tokens",
      });
    }
  }

  /**
   * Obtenir le profil de l'utilisateur connecté
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: "User profile not found",
        });
      }

      res.json({
        success: true,
        data: {
          user: user.toPublicJSON(),
        },
      });
    } catch (error) {
      logger.error("Get profile error", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to fetch profile",
        message: "An unexpected error occurred while fetching profile",
      });
    }
  }

  /**
   * Obtenir les statistiques de l'utilisateur
   */
  async getUserStats(req, res) {
    try {
      const stats = await User.getUserStats(req.user.id);

      res.json({
        success: true,
        data: {
          stats,
        },
      });
    } catch (error) {
      logger.error("Get user stats error", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to fetch statistics",
        message: "An unexpected error occurred while fetching statistics",
      });
    }
  }

  /**
   * Helper: Créer une session utilisateur
   */
  async createSession(userId, ipAddress, userAgent, token) {
    try {
      const sessionData = {
        user_id: userId,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      };

      // Hasher le token pour le stocker
      const sessionToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      // Stocker en Redis avec expiration automatique
      await redisClient.set(
        `session:${sessionToken}`,
        JSON.stringify(sessionData),
        {
          EX: 24 * 60 * 60, // 24h en secondes
        }
      );
    } catch (error) {
      logger.error("Create session error", { error: error.message, userId });
    }
  }

  /**
   * Helper: Supprimer les sessions d'un utilisateur
   */
  async removeUserSessions(userId) {
    try {
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
    } catch (error) {
      logger.error("Remove user sessions error", {
        error: error.message,
        userId,
      });
    }
  }

  /**
   * Helper: Incrémenter les tentatives échouées
   */
  async incrementFailedAttempts(userId, ipAddress) {
    try {
      const userKey = `failed_attempts:user:${userId}`;
      const ipKey = `failed_attempts:ip:${ipAddress}`;

      await Promise.all([
        redisClient.incr(userKey),
        redisClient.expire(userKey, 15 * 60), // 15 minutes
        redisClient.incr(ipKey),
        redisClient.expire(ipKey, 15 * 60), // 15 minutes
      ]);
    } catch (error) {
      logger.error("Increment failed attempts error", {
        error: error.message,
        userId,
        ipAddress,
      });
    }
  }

  /**
   * Helper: Réinitialiser les tentatives échouées
   */
  async resetFailedAttempts(userId, ipAddress) {
    try {
      await Promise.all([
        redisClient.del(`failed_attempts:user:${userId}`),
        redisClient.del(`failed_attempts:ip:${ipAddress}`),
      ]);
    } catch (error) {
      logger.error("Reset failed attempts error", {
        error: error.message,
        userId,
        ipAddress,
      });
    }
  }
}

module.exports = new AuthController();
