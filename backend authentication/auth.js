'use strict';

const jwt    = require('jsonwebtoken');
const User   = require('./UserMongo');   // Mongoose model
const redis  = require('./redis');
const logger = require('./logger');

// ─────────────────────────────────────────────────────────────────────────────
// protect — Primary authentication gate
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Verifies the Bearer access token in the Authorization header.
 *
 * Checks performed (in order):
 *  1. Token present in header
 *  2. JWT signature + expiry valid
 *  3. Token is NOT blacklisted in Redis (logout guard)
 *  4. User still exists and is active in MongoDB
 *  5. Password has not been changed after token was issued
 *
 * On success: attaches `req.user` (Mongoose doc) and `req.token` (raw JWT).
 */
exports.protect = async (req, res, next) => {
  try {
    // ── 1. Extract token ─────────────────────────────────────────────────────
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // ── 2. Verify JWT ────────────────────────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'ecommerce-api',
      });
    } catch (jwtErr) {
      const message =
        jwtErr.name === 'TokenExpiredError'
          ? 'Session expired. Please log in again.'
          : 'Invalid token. Please log in again.';
      return res.status(401).json({ success: false, message });
    }

    // ── 3. Check blacklist (logout / revocation) ─────────────────────────────
    const blacklistKey = `bl:${token}`;
    const isBlacklisted = await redis.get(blacklistKey);

    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please log in again.',
      });
    }

    // ── 4. Fetch user from MongoDB ───────────────────────────────────────────
    const user = await User.findById(decoded.sub).select('+passwordChangedAt');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The account associated with this token no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // ── 5. Detect post-issue password change ─────────────────────────────────
    if (user.passwordChangedAfter && user.passwordChangedAfter(decoded.iat)) {
      return res.status(401).json({
        success: false,
        message: 'Password was recently changed. Please log in again.',
      });
    }

    // ── Attach to request ────────────────────────────────────────────────────
    req.user  = user;
    req.token = token;

    next();
  } catch (err) {
    logger.error('protect middleware error', { err });
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to a server error.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// authorize — Role-based access control (RBAC)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Usage: router.delete('/product/:id', protect, authorize('admin', 'vendor'), handler)
 */
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of: [${roles.join(', ')}]. Your role: ${req.user.role}.`,
    });
  }

  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// optionalAuth — Attach user if token present, but don't block if absent
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Use on public routes that behave differently for logged-in users
 * (e.g., product listing with personalised wishlist state).
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];

    // Quick blacklist check
    const isBlacklisted = await redis.get(`bl:${token}`);
    if (isBlacklisted) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'ecommerce-api',
    });

    const user = await User.findById(decoded.sub);
    if (user && user.isActive) {
      req.user  = user;
      req.token = token;
    }
  } catch (_) {
    // Silently ignore invalid/expired tokens on optional routes
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// verifyOwnership — Ensure the authenticated user owns the resource
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Usage: router.put('/orders/:id', protect, verifyOwnership('userId'), handler)
 * Compares req.params[paramField] with req.user._id.
 * Admins bypass the check entirely.
 */
exports.verifyOwnership = (paramField = 'userId') => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  // Admins can access any resource
  if (req.user.role === 'admin') return next();

  const paramId = req.params[paramField];
  if (paramId && String(req.user._id) !== String(paramId)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource.',
    });
  }

  next();
};
