/**
 * ============================================================
 * AUTH CONTROLLER — E-Commerce Application
 * ============================================================
 * Exports:
 *   registerUser()   — Create account + send OTP
 *   loginUser()      — Credentials check + OTP requirement
 *   verifyOTP()      — Verify email/phone OTP
 *   refreshToken()   — Rotate access/refresh JWT pair
 *   logoutUser()     — Blacklist token + purge refresh key
 * ============================================================
 * Stack: MongoDB · Mongoose · bcrypt · JWT · Redis (ioredis)
 *        Express Validator · Nodemailer · Twilio (optional)
 * ============================================================
 */

'use strict';

const bcrypt        = require('bcrypt');
const jwt           = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const User          = require('./UserMongo');          // Mongoose model
const redis         = require('./redis');              // ioredis instance
const emailService  = require('./emailService');
const { validateUserInput } = require('./validators'); // Manual validation layer
const smsService    = require('./smsService');
const { generateOTP, validateOTP } = require('./otp');
const logger        = require('./logger');

// ─── Constants ────────────────────────────────────────────────────────────────
const SALT_ROUNDS          = 12;
const OTP_TTL_SECONDS      = 300;   // 5 minutes
const OTP_MAX_ATTEMPTS     = 5;     // brute-force guard
const REFRESH_TOKEN_TTL    = 60 * 60 * 24 * 7; // 7 days (seconds)
const LOGIN_RATE_KEY_TTL   = 60 * 15;           // 15-minute window
const LOGIN_MAX_ATTEMPTS   = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sign a short-lived access token (15 min default).
 */
const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m', issuer: 'ecommerce-api' }
  );

/**
 * Sign a long-lived refresh token (7 days default).
 * A separate secret makes it safe to rotate independently.
 */
const signRefreshToken = (user) =>
  jwt.sign(
    { sub: user._id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d', issuer: 'ecommerce-api' }
  );

/**
 * Build the safe user object returned to the client.
 */
const sanitizeUser = (user) => ({
  id:          user._id,
  email:       user.email,
  phone:       user.phone,
  firstName:   user.firstName,
  lastName:    user.lastName,
  role:        user.role,
  isVerified:  user.isVerified,
  avatar:      user.avatar,
  createdAt:   user.createdAt,
});

/**
 * Standardised validation-error response.
 */
const sendValidationError = (res, errors) =>
  res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors:  errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });

/**
 * Compute the remaining TTL of a Redis key in seconds.
 * Returns 0 when the key does not exist.
 */
const redisTTL = async (key) => {
  const ttl = await redis.ttl(key);
  return ttl > 0 ? ttl : 0;
};

// ─── Redis Key Builders ───────────────────────────────────────────────────────
const Keys = {
  otp:              (userId, channel) => `otp:${channel}:${userId}`,
  otpAttempts:      (userId, channel) => `otp:attempts:${channel}:${userId}`,
  refreshToken:     (userId)          => `refresh:${userId}`,
  tokenBlacklist:   (jti)             => `bl:${jti}`,
  loginAttempts:    (email)           => `login:attempts:${email}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. REGISTER USER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 *
 * Body: { firstName, lastName, email, phone?, password }
 *
 * Flow:
 *  1. Run express-validator rules
 *  2. Duplicate check (email + phone)
 *  3. Hash password with bcrypt (12 rounds)
 *  4. Persist user to MongoDB
 *  5. Generate & store OTP in Redis (5 min TTL)
 *  6. Dispatch verification email (+ SMS if phone supplied)
 *  7. Return user snapshot — no tokens yet (pending OTP)
 */
exports.registerUser = async (req, res) => {
  // ── 1a. Manual validation (validateUserInput) ────────────────────────────────
  const { isValid, errors: inputErrors } = validateUserInput(req.body, 'register');
  if (!isValid) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors:  inputErrors,
    });
  }

  // ── 1b. Express-validator rules (schema-level checks) ────────────────────────
  const schemaErrors = validationResult(req);
  if (!schemaErrors.isEmpty()) return sendValidationError(res, schemaErrors);

  const { firstName, lastName, email, phone, password } = req.body;

  try {
    // ── 2. Duplicate check ───────────────────────────────────────────────────
    const query = [{ email: email.toLowerCase() }];
    if (phone) query.push({ phone });

    const existing = await User.findOne({ $or: query }).lean();
    if (existing) {
      const field = existing.email === email.toLowerCase() ? 'email' : 'phone';
      return res.status(409).json({
        success: false,
        message: `An account with this ${field} already exists`,
      });
    }

    // ── 3. Hash password ─────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // ── 4. Create user ───────────────────────────────────────────────────────
    const user = await User.create({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.toLowerCase().trim(),
      phone:     phone || undefined,
      password:  hashedPassword,
      role:      'customer',
      isVerified: false,
      isActive:  true,
    });

    // ── 5. Generate & cache OTP ──────────────────────────────────────────────
    const emailOTP = generateOTP();
    await redis.setex(Keys.otp(user._id, 'email'), OTP_TTL_SECONDS, emailOTP);

    let phoneOTP = null;
    if (phone) {
      phoneOTP = generateOTP();
      await redis.setex(Keys.otp(user._id, 'phone'), OTP_TTL_SECONDS, phoneOTP);
    }

    // ── 6. Dispatch notifications ────────────────────────────────────────────
    //  Fire-and-forget: don't block the response on email/SMS errors.
    emailService.sendVerificationEmail(user.email, emailOTP).catch((err) =>
      logger.error('Verification email failed', { userId: user._id, err })
    );

    if (phone && phoneOTP) {
      smsService.sendOTP(phone, phoneOTP).catch((err) =>
        logger.error('Verification SMS failed', { userId: user._id, err })
      );
    }

    logger.info('User registered', { userId: user._id, email: user.email });

    // ── 7. Respond ───────────────────────────────────────────────────────────
    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your account with the OTP sent to your email.',
      data: {
        user:           sanitizeUser(user),
        otpExpiresSecs: OTP_TTL_SECONDS,
        verificationRequired: true,
      },
    });
  } catch (err) {
    logger.error('registerUser error', { err });
    return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOGIN USER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 *
 * Body: { email, password }
 *
 * Flow:
 *  1. Validate input
 *  2. Rate-limit consecutive failures per email (Redis counter)
 *  3. Fetch user + compare bcrypt hash
 *  4. If unverified → re-send OTP, return 403
 *  5. Sign access + refresh tokens; store refresh token in Redis
 *  6. Update lastLoginAt
 */
exports.loginUser = async (req, res) => {
  // ── 1a. Manual validation (validateUserInput) ────────────────────────────────
  const { isValid, errors: inputErrors } = validateUserInput(req.body, 'login');
  if (!isValid) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors:  inputErrors,
    });
  }

  // ── 1b. Express-validator rules ──────────────────────────────────────────────
  const schemaErrors = validationResult(req);
  if (!schemaErrors.isEmpty()) return sendValidationError(res, schemaErrors);

  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // ── 2. Rate limit ────────────────────────────────────────────────────────
    const attemptKey = Keys.loginAttempts(normalizedEmail);
    const attempts   = parseInt((await redis.get(attemptKey)) || '0', 10);

    if (attempts >= LOGIN_MAX_ATTEMPTS) {
      const retryAfter = await redisTTL(attemptKey);
      return res.status(429).json({
        success: false,
        message: 'Too many failed login attempts. Please try again later.',
        retryAfterSecs: retryAfter,
      });
    }

    // ── 3. Fetch + verify credentials ───────────────────────────────────────
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    const isMatch = user ? await bcrypt.compare(password, user.password) : false;

    if (!user || !isMatch) {
      // Increment failure counter (set TTL only on first failure)
      const newCount = await redis.incr(attemptKey);
      if (newCount === 1) await redis.expire(attemptKey, LOGIN_RATE_KEY_TTL);

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        attemptsLeft: Math.max(0, LOGIN_MAX_ATTEMPTS - newCount),
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // ── 4. Block unverified users; re-send OTP ───────────────────────────────
    if (!user.isVerified) {
      const existingTTL = await redisTTL(Keys.otp(user._id, 'email'));

      if (existingTTL === 0) {
        // No live OTP — generate & send a fresh one
        const freshOTP = generateOTP();
        await redis.setex(Keys.otp(user._id, 'email'), OTP_TTL_SECONDS, freshOTP);
        emailService.sendVerificationEmail(user.email, freshOTP).catch((err) =>
          logger.error('Re-send OTP email failed', { userId: user._id, err })
        );
      }

      return res.status(403).json({
        success: false,
        message: 'Account not verified. A new OTP has been sent to your email.',
        userId: user._id,
        verificationRequired: true,
        otpExpiresSecs: existingTTL || OTP_TTL_SECONDS,
      });
    }

    // ── 5. Generate tokens ───────────────────────────────────────────────────
    const accessToken  = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // Store refresh token hash in Redis (allows server-side revocation)
    const rtHash = require('crypto')
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await redis.setex(Keys.refreshToken(user._id), REFRESH_TOKEN_TTL, rtHash);

    // ── 6. Update lastLoginAt ────────────────────────────────────────────────
    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

    // Clear any login-failure counter
    await redis.del(attemptKey);

    logger.info('User logged in', { userId: user._id });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: sanitizeUser(user),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRE || '15m',
        },
      },
    });
  } catch (err) {
    logger.error('loginUser error', { err });
    return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. VERIFY OTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/verify-otp
 *
 * Body: { userId, otp, channel }   channel → "email" | "phone"
 *
 * Flow:
 *  1. Validate
 *  2. Guard against brute-force (max 5 attempts per OTP session)
 *  3. Fetch OTP from Redis & do constant-time comparison
 *  4. Mark user verified; set emailVerifiedAt / phoneVerifiedAt
 *  5. Delete OTP + attempt counter from Redis
 *  6. Issue full token pair (first login after verification)
 */
exports.verifyOTP = async (req, res) => {
  // ── 1. Validate ─────────────────────────────────────────────────────────────
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidationError(res, errors);

  const { userId, otp, channel = 'email' } = req.body;

  if (!['email', 'phone'].includes(channel)) {
    return res.status(400).json({ success: false, message: 'Invalid channel. Must be "email" or "phone".' });
  }

  if (!validateOTP(otp)) {
    return res.status(400).json({ success: false, message: 'OTP must be a 6-digit number.' });
  }

  try {
    // ── 2. Brute-force guard ─────────────────────────────────────────────────
    const attemptsKey = Keys.otpAttempts(userId, channel);
    const attempts    = parseInt((await redis.get(attemptsKey)) || '0', 10);

    if (attempts >= OTP_MAX_ATTEMPTS) {
      // Purge OTP so they must request a new one
      await redis.del(Keys.otp(userId, channel));
      await redis.del(attemptsKey);

      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new OTP.',
      });
    }

    // ── 3. Fetch & compare OTP ───────────────────────────────────────────────
    const storedOTP = await redis.get(Keys.otp(userId, channel));

    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired or does not exist. Please request a new one.',
      });
    }

    // Constant-time comparison to prevent timing attacks
    const crypto = require('crypto');
    const otpMatch =
      storedOTP.length === otp.length &&
      crypto.timingSafeEqual(Buffer.from(storedOTP), Buffer.from(otp));

    if (!otpMatch) {
      const newCount = await redis.incr(attemptsKey);
      // Sync attempt-counter TTL with OTP TTL
      const remaining = await redisTTL(Keys.otp(userId, channel));
      if (newCount === 1 && remaining > 0) await redis.expire(attemptsKey, remaining);

      return res.status(400).json({
        success: false,
        message: 'Invalid OTP.',
        attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - newCount),
      });
    }

    // ── 4. Mark verified ─────────────────────────────────────────────────────
    const updatePayload =
      channel === 'email'
        ? { isVerified: true, emailVerifiedAt: new Date() }
        : { phoneVerifiedAt: new Date() };

    const user = await User.findByIdAndUpdate(userId, updatePayload, { new: true });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // ── 5. Cleanup Redis ─────────────────────────────────────────────────────
    await redis.del(Keys.otp(userId, channel));
    await redis.del(attemptsKey);

    // ── 6. Issue tokens (post-verification first login) ──────────────────────
    const accessToken  = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    const rtHash = require('crypto')
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await redis.setex(Keys.refreshToken(user._id), REFRESH_TOKEN_TTL, rtHash);

    logger.info('OTP verified', { userId: user._id, channel });

    return res.status(200).json({
      success: true,
      message: `${channel === 'email' ? 'Email' : 'Phone'} verified successfully.`,
      data: {
        user: sanitizeUser(user),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRE || '15m',
        },
      },
    });
  } catch (err) {
    logger.error('verifyOTP error', { err });
    return res.status(500).json({ success: false, message: 'OTP verification failed. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. REFRESH TOKEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh-token
 *
 * Body: { refreshToken }
 *
 * Flow:
 *  1. Verify JWT signature + expiry
 *  2. Validate token hash against Redis (detects revoked tokens)
 *  3. Ensure user is still active
 *  4. Rotate: issue new access + refresh pair
 *  5. Delete old refresh key; store new hash
 */
exports.refreshToken = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidationError(res, errors);

  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token is required.' });
  }

  try {
    // ── 1. Verify JWT ────────────────────────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { issuer: 'ecommerce-api' }
      );
    } catch (jwtErr) {
      const msg =
        jwtErr.name === 'TokenExpiredError'
          ? 'Refresh token has expired. Please log in again.'
          : 'Invalid refresh token.';
      return res.status(401).json({ success: false, message: msg });
    }

    const userId = decoded.sub;

    // ── 2. Validate hash in Redis ────────────────────────────────────────────
    const crypto  = require('crypto');
    const rtHash  = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored  = await redis.get(Keys.refreshToken(userId));

    if (!stored || stored !== rtHash) {
      // Possible token reuse — invalidate everything for safety (rotation attack)
      await redis.del(Keys.refreshToken(userId));
      return res.status(401).json({
        success: false,
        message: 'Refresh token has already been used or revoked. Please log in again.',
      });
    }

    // ── 3. Fetch user ────────────────────────────────────────────────────────
    const user = await User.findById(userId);

    if (!user || !user.isActive) {
      await redis.del(Keys.refreshToken(userId));
      return res.status(401).json({
        success: false,
        message: 'User account not found or deactivated.',
      });
    }

    // ── 4 & 5. Rotate tokens ─────────────────────────────────────────────────
    const newAccessToken  = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    const newRtHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    // Atomic swap: delete old, store new
    await redis.del(Keys.refreshToken(userId));
    await redis.setex(Keys.refreshToken(userId), REFRESH_TOKEN_TTL, newRtHash);

    logger.info('Tokens rotated', { userId });

    return res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully.',
      data: {
        tokens: {
          accessToken:  newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn:    process.env.JWT_EXPIRE || '15m',
        },
      },
    });
  } catch (err) {
    logger.error('refreshToken error', { err });
    return res.status(500).json({ success: false, message: 'Token refresh failed. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. LOGOUT USER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 *
 * Headers: Authorization: Bearer <accessToken>
 * Body (optional): { refreshToken }
 *
 * Flow:
 *  1. Extract + decode access token (already verified by `protect` middleware)
 *  2. Blacklist the access token in Redis until its natural expiry
 *  3. Delete the stored refresh token hash (server-side revocation)
 *  4. Respond 200 — always succeeds even if tokens are already gone
 */
exports.logoutUser = async (req, res) => {
  try {
    const accessToken  = req.token;           // injected by protect() middleware
    const { refreshToken } = req.body || {};
    const userId = req.user?._id;

    const promises = [];

    // ── 2. Blacklist access token ────────────────────────────────────────────
    if (accessToken) {
      let ttl = 900; // default 15 min fallback
      try {
        const decoded = jwt.decode(accessToken);
        if (decoded?.exp) {
          ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
        }
      } catch (_) { /* ignore decode errors */ }

      if (ttl > 0) {
        promises.push(redis.setex(Keys.tokenBlacklist(accessToken), ttl, '1'));
      }
    }

    // ── 3. Revoke refresh token ──────────────────────────────────────────────
    if (userId) {
      promises.push(redis.del(Keys.refreshToken(String(userId))));
    }

    await Promise.allSettled(promises);

    logger.info('User logged out', { userId });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    logger.error('logoutUser error', { err });
    // Always return 200 for logout — client clears local tokens regardless
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BONUS HELPERS (used by other parts of the app)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/resend-otp
 * Body: { userId, channel }   channel → "email" | "phone"
 *
 * Throttled: client must wait until existing OTP expires before getting a new one.
 */
exports.resendOTP = async (req, res) => {
  const { userId, channel = 'email' } = req.body;

  if (!userId || !['email', 'phone'].includes(channel)) {
    return res.status(400).json({ success: false, message: 'userId and valid channel are required.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Throttle: do not re-send while a live OTP exists
    const remaining = await redisTTL(Keys.otp(userId, channel));
    if (remaining > 0) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${remaining} seconds before requesting a new OTP.`,
        retryAfterSecs: remaining,
      });
    }

    const newOTP = generateOTP();
    await redis.setex(Keys.otp(userId, channel), OTP_TTL_SECONDS, newOTP);
    // Reset attempt counter
    await redis.del(Keys.otpAttempts(userId, channel));

    if (channel === 'email') {
      emailService.sendVerificationEmail(user.email, newOTP).catch((e) =>
        logger.error('Resend OTP email failed', { userId, e })
      );
    } else {
      if (!user.phone)
        return res.status(400).json({ success: false, message: 'No phone number on file.' });
      smsService.sendOTP(user.phone, newOTP).catch((e) =>
        logger.error('Resend OTP SMS failed', { userId, e })
      );
    }

    logger.info('OTP resent', { userId, channel });

    return res.status(200).json({
      success: true,
      message: `A new OTP has been sent to your ${channel}.`,
      otpExpiresSecs: OTP_TTL_SECONDS,
    });
  } catch (err) {
    logger.error('resendOTP error', { err });
    return res.status(500).json({ success: false, message: 'Failed to resend OTP.' });
  }
};

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always respond 200 to prevent user enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If that email is registered, a reset link has been sent.',
      });
    }

    const resetToken = jwt.sign(
      { sub: user._id, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await redis.setex(`reset:${user._id}`, 3600, resetToken);
    emailService.sendPasswordResetEmail(user.email, resetToken).catch((e) =>
      logger.error('Password reset email failed', { userId: user._id, e })
    );

    return res.status(200).json({
      success: true,
      message: 'If that email is registered, a reset link has been sent.',
    });
  } catch (err) {
    logger.error('forgotPassword error', { err });
    return res.status(500).json({ success: false, message: 'Request failed. Please try again.' });
  }
};

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 */
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ success: false, message: 'Token and new password are required.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== 'password-reset')
      return res.status(400).json({ success: false, message: 'Invalid reset token.' });

    const stored = await redis.get(`reset:${decoded.sub}`);
    if (!stored || stored !== token)
      return res.status(400).json({ success: false, message: 'Reset token is invalid or has already been used.' });

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await User.findByIdAndUpdate(decoded.sub, { password: hashed });
    await redis.del(`reset:${decoded.sub}`);
    // Revoke existing refresh token so old sessions cannot continue
    await redis.del(Keys.refreshToken(decoded.sub));

    logger.info('Password reset', { userId: decoded.sub });

    return res.status(200).json({ success: true, message: 'Password reset successful. Please log in.' });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    logger.error('resetPassword error', { err });
    return res.status(500).json({ success: false, message: 'Password reset failed.' });
  }
};
