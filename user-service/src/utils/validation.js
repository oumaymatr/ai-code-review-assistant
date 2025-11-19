/**
 * Utilitaires de validation pour User Service
 */

const Joi = require("joi");
const config = require("../config/config");

/**
 * Schéma de validation pour l'inscription
 */
const registerSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .max(255)
    .required()
    .messages({
      "string.email": "Please provide a valid email address",
      "string.empty": "Email is required",
      "string.max": "Email must be less than 255 characters",
    }),

  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .lowercase()
    .required()
    .messages({
      "string.alphanum": "Username must only contain alphanumeric characters",
      "string.min": "Username must be at least 3 characters long",
      "string.max": "Username must be less than 30 characters",
      "string.empty": "Username is required",
    }),

  password: Joi.string()
    .min(config.security.passwordMinLength)
    .max(config.security.passwordMaxLength)
    .required()
    .messages({
      "string.min": `Password must be at least ${config.security.passwordMinLength} characters long`,
      "string.max": `Password must be less than ${config.security.passwordMaxLength} characters`,
      "string.empty": "Password is required",
    }),

  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "string.empty": "Password confirmation is required",
  }),

  full_name: Joi.string().min(2).max(255).optional().allow(null, "").messages({
    "string.min": "Full name must be at least 2 characters long",
    "string.max": "Full name must be less than 255 characters",
  }),

  acceptTerms: Joi.boolean().valid(true).required().messages({
    "any.only": "You must accept the terms and conditions",
  }),
});

/**
 * Schéma de validation pour la connexion
 */
const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .required()
    .messages({
      "string.email": "Please provide a valid email address",
      "string.empty": "Email is required",
    }),

  password: Joi.string().required().messages({
    "string.empty": "Password is required",
  }),

  rememberMe: Joi.boolean().optional().default(false),
});

/**
 * Schéma de validation pour la mise à jour du profil
 */
const updateProfileSchema = Joi.object({
  full_name: Joi.string().min(2).max(255).optional().allow(null, "").messages({
    "string.min": "Full name must be at least 2 characters long",
    "string.max": "Full name must be less than 255 characters",
  }),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .max(255)
    .optional()
    .messages({
      "string.email": "Please provide a valid email address",
      "string.max": "Email must be less than 255 characters",
    }),

  avatar_url: Joi.string().uri().max(500).optional().allow(null, "").messages({
    "string.uri": "Avatar URL must be a valid URL",
    "string.max": "Avatar URL must be less than 500 characters",
  }),
});

/**
 * Schéma de validation pour le changement de mot de passe
 */
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "string.empty": "Current password is required",
  }),

  newPassword: Joi.string()
    .min(config.security.passwordMinLength)
    .max(config.security.passwordMaxLength)
    .required()
    .messages({
      "string.min": `New password must be at least ${config.security.passwordMinLength} characters long`,
      "string.max": `New password must be less than ${config.security.passwordMaxLength} characters`,
      "string.empty": "New password is required",
    }),

  confirmNewPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "New passwords do not match",
      "string.empty": "New password confirmation is required",
    }),
});

/**
 * Schéma de validation pour la réinitialisation de mot de passe
 */
const passwordResetSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .required()
    .messages({
      "string.email": "Please provide a valid email address",
      "string.empty": "Email is required",
    }),
});

/**
 * Schéma de validation pour la confirmation de réinitialisation
 */
const passwordResetConfirmSchema = Joi.object({
  token: Joi.string().required().messages({
    "string.empty": "Reset token is required",
  }),

  newPassword: Joi.string()
    .min(config.security.passwordMinLength)
    .max(config.security.passwordMaxLength)
    .required()
    .messages({
      "string.min": `Password must be at least ${config.security.passwordMinLength} characters long`,
      "string.max": `Password must be less than ${config.security.passwordMaxLength} characters`,
      "string.empty": "New password is required",
    }),

  confirmNewPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "string.empty": "Password confirmation is required",
    }),
});

/**
 * Validation personnalisée de la force du mot de passe
 */
const validatePasswordStrength = (password) => {
  const checks = {
    length: password.length >= config.security.passwordMinLength,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  return {
    isValid: score >= 3, // Au moins 3 critères sur 5
    score,
    checks,
    strength: score < 2 ? "weak" : score < 4 ? "medium" : "strong",
  };
};

/**
 * Validation d'email avancée
 */
const validateEmail = (email) => {
  const checks = {
    format: config.security.emailRegex.test(email),
    length: email.length <= 255,
    noSpaces: !/\s/.test(email),
    validDomain: email.includes(".") && !email.endsWith("."),
    noConsecutiveDots: !email.includes(".."),
    noStartDot: !email.startsWith("."),
    noEndDot: !email.endsWith("."),
  };

  const isValid = Object.values(checks).every(Boolean);

  return {
    isValid,
    checks,
    normalized: email.toLowerCase().trim(),
  };
};

/**
 * Validation d'username
 */
const validateUsername = (username) => {
  const checks = {
    format: config.security.usernameRegex.test(username),
    length: username.length >= 3 && username.length <= 30,
    noSpaces: !/\s/.test(username),
    alphanumeric: /^[a-zA-Z0-9_-]+$/.test(username),
    notReserved: !["admin", "root", "system", "api", "www", "mail"].includes(
      username.toLowerCase()
    ),
  };

  const isValid = Object.values(checks).every(Boolean);

  return {
    isValid,
    checks,
    normalized: username.toLowerCase().trim(),
  };
};

/**
 * Middleware de validation générique
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }));

      return res.status(400).json({
        success: false,
        error: "Validation failed",
        message: "Please check your input and try again",
        code: "VALIDATION_ERROR",
        details: validationErrors,
      });
    }

    // Remplacer req.body par les données validées
    req.body = value;
    next();
  };
};

/**
 * Validation de fichier d'avatar
 */
const validateAvatarFile = (file) => {
  if (!file) {
    return { isValid: false, error: "No file provided" };
  }

  // Vérifier la taille
  if (file.size > config.upload.maxFileSize) {
    return {
      isValid: false,
      error: `File too large. Maximum size is ${Math.round(config.upload.maxFileSize / 1024 / 1024)}MB`,
    };
  }

  // Vérifier le type MIME
  if (!config.upload.allowedTypes.includes(file.mimetype)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${config.upload.allowedTypes.join(", ")}`,
    };
  }

  return { isValid: true };
};

module.exports = {
  // Schémas Joi
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  passwordResetSchema,
  passwordResetConfirmSchema,

  // Validations personnalisées
  validatePasswordStrength,
  validateEmail,
  validateUsername,
  validateAvatarFile,

  // Middleware
  validate,
};
