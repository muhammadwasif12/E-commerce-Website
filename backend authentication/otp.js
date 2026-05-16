'use strict';

/**
 * ============================================================
 * OTP Utility — Cryptographically Secure
 * ============================================================
 * Uses Node's built-in `crypto` module for CSPRNG instead of
 * Math.random(), which is NOT cryptographically safe for OTPs.
 * ============================================================
 */

const crypto = require('crypto');

/**
 * Generate a cryptographically secure 6-digit OTP string.
 * Range: 100000 – 999999 (always 6 digits, no leading zeros).
 *
 * @returns {string}  e.g. "483920"
 */
exports.generateOTP = () => {
  // randomInt(min, max) is CSPRNG — inclusive min, exclusive max
  const otp = crypto.randomInt(100_000, 1_000_000);
  return otp.toString();
};

/**
 * Validate that a string is exactly 6 decimal digits.
 *
 * @param  {string} otp
 * @returns {boolean}
 */
exports.validateOTP = (otp) => {
  return typeof otp === 'string' && /^\d{6}$/.test(otp);
};

/**
 * Generate a cryptographically secure random hex token.
 * Default length: 32 bytes → 64-char hex string.
 *
 * @param  {number} bytes
 * @returns {string}
 */
exports.generateToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Generate a URL-safe base64 token (shorter than hex).
 *
 * @param  {number} bytes
 * @returns {string}
 */
exports.generateUrlSafeToken = (bytes = 32) => {
  return crypto
    .randomBytes(bytes)
    .toString('base64url');   // Node ≥ 14.18
};
