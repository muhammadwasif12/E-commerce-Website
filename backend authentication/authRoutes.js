'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const router  = express.Router();

const authController = require('./authController');
const { protect }    = require('./auth');

// ─────────────────────────────────────────────────────────────────────────────
// Validation Rule Sets
// ─────────────────────────────────────────────────────────────────────────────

/** POST /register */
const registerRules = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be 2–50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name contains invalid characters'),

  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2–50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name contains invalid characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage('Password must contain at least one special character'),

  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your password')
    .custom((val, { req }) => {
      if (val !== req.body.password) throw new Error('Passwords do not match');
      return true;
    }),
];

/** POST /login */
const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

/** POST /verify-otp */
const verifyOTPRules = [
  body('userId')
    .notEmpty().withMessage('userId is required')
    .isMongoId().withMessage('userId must be a valid MongoDB ObjectId'),

  body('otp')
    .notEmpty().withMessage('OTP is required')
    .matches(/^\d{6}$/).withMessage('OTP must be exactly 6 digits'),

  body('channel')
    .optional()
    .isIn(['email', 'phone']).withMessage('channel must be "email" or "phone"'),
];

/** POST /refresh-token */
const refreshTokenRules = [
  body('refreshToken')
    .notEmpty().withMessage('refreshToken is required')
    .isJWT().withMessage('refreshToken must be a valid JWT'),
];

/** POST /resend-otp */
const resendOTPRules = [
  body('userId')
    .notEmpty().withMessage('userId is required')
    .isMongoId().withMessage('userId must be a valid MongoDB ObjectId'),

  body('channel')
    .optional()
    .isIn(['email', 'phone']).withMessage('channel must be "email" or "phone"'),
];

/** POST /forgot-password */
const forgotPasswordRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

/** POST /reset-password */
const resetPasswordRules = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage('Password must contain at least one special character'),

  body('confirmNewPassword')
    .notEmpty().withMessage('Please confirm your new password')
    .custom((val, { req }) => {
      if (val !== req.body.newPassword) throw new Error('Passwords do not match');
      return true;
    }),
];

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/register',         registerRules,        authController.registerUser);
router.post('/login',            loginRules,           authController.loginUser);
router.post('/verify-otp',       verifyOTPRules,       authController.verifyOTP);
router.post('/refresh-token',    refreshTokenRules,    authController.refreshToken);
router.post('/resend-otp',       resendOTPRules,       authController.resendOTP);
router.post('/forgot-password',  forgotPasswordRules,  authController.forgotPassword);
router.post('/reset-password',   resetPasswordRules,   authController.resetPassword);

// ── Protected (requires valid Bearer token) ───────────────────────────────────
router.post('/logout', protect, authController.logoutUser);

module.exports = router;
