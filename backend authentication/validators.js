'use strict';

/**
 * @fileoverview Input validation utilities for the E-Commerce auth system.
 *
 * All validators follow the early-return pattern and return a
 * uniform result object: `{ isValid: boolean, errors: Record<string, string> }`.
 *
 * Pakistani phone numbers must follow the E.164 format used by PTA:
 *   +92 3XX XXXXXXX  →  regex: /^\+92[3][0-9]{9}$/
 *   Examples: +923001234567  +923211234567  +923451234567
 */

// ─────────────────────────────────────────────────────────────────────────────
// Internal Constants & Regex Patterns
// ─────────────────────────────────────────────────────────────────────────────

/** Pakistani mobile numbers: +92 followed by a '3' series and 9 digits. */
const PK_PHONE_REGEX = /^\+92[3][0-9]{9}$/;

/** Broad email format check (RFC-5321 simplified). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Name: letters, spaces, hyphens, apostrophes only. */
const NAME_REGEX = /^[a-zA-Z\s'\-]+$/;

/**
 * Password strength rules (each independently checked so the caller
 * can surface fine-grained feedback to the client).
 */
const PASSWORD_RULES = [
  { regex: /.{8,}/,          message: 'Password must be at least 8 characters long.'           },
  { regex: /[A-Z]/,          message: 'Password must contain at least one uppercase letter.'    },
  { regex: /[a-z]/,          message: 'Password must contain at least one lowercase letter.'    },
  { regex: /\d/,             message: 'Password must contain at least one number.'              },
  { regex: /[@$!%*?&#^()\-_=+[\]{};:'",.<>/?\\|`~]/, message: 'Password must contain at least one special character.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Private Field Validators (single responsibility, always return a string|null)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a name field (firstName or lastName).
 *
 * @param  {string} value - The raw name string.
 * @param  {string} label - Human-readable field label for error messages.
 * @returns {string|null}  Error message, or null when valid.
 */
const _validateName = (value, label) => {
  if (!value || typeof value !== 'string') return `${label} is required.`;

  const trimmed = value.trim();

  if (trimmed.length === 0) return `${label} cannot be blank.`;
  if (trimmed.length < 2)   return `${label} must be at least 2 characters.`;
  if (trimmed.length > 50)  return `${label} cannot exceed 50 characters.`;
  if (!NAME_REGEX.test(trimmed))
    return `${label} may only contain letters, spaces, hyphens, or apostrophes.`;

  return null; // ✅ valid
};

/**
 * Validate an email address.
 *
 * @param  {string} value - Raw email string.
 * @returns {string|null}  Error message, or null when valid.
 */
const _validateEmail = (value) => {
  if (!value || typeof value !== 'string') return 'Email address is required.';

  const trimmed = value.trim();

  if (trimmed.length === 0) return 'Email address cannot be blank.';
  if (trimmed.length > 254) return 'Email address is too long (max 254 characters).';
  if (!EMAIL_REGEX.test(trimmed)) return 'Please provide a valid email address.';

  return null; // ✅ valid
};

/**
 * Validate a Pakistani phone number.
 *
 * Accepts:
 *  - E.164 format:   +923001234567
 *  - Local format:   03001234567  (auto-normalized to +92 form for the check)
 *
 * @param  {string} value - Raw phone string.
 * @returns {string|null}  Error message, or null when valid.
 */
const _validatePakistaniPhone = (value) => {
  if (!value || typeof value !== 'string') return 'Phone number is required.';

  // Normalize: strip whitespace and dashes, convert local "0" prefix to "+92"
  let normalized = value.trim().replace(/[\s\-().]/g, '');

  if (normalized.startsWith('0')) {
    normalized = '+92' + normalized.slice(1);
  }

  if (!PK_PHONE_REGEX.test(normalized)) {
    return (
      'Please provide a valid Pakistani mobile number. ' +
      'Accepted format: +923001234567 or 03001234567.'
    );
  }

  return null; // ✅ valid
};

/**
 * Validate a password against all strength rules.
 * Returns the FIRST failing rule's message so the UI can guide
 * the user step-by-step.
 *
 * @param  {string} value - Raw password string.
 * @returns {string|null}  Error message, or null when all rules pass.
 */
const _validatePassword = (value) => {
  if (!value || typeof value !== 'string') return 'Password is required.';
  if (value.length > 128) return 'Password cannot exceed 128 characters.';

  for (const rule of PASSWORD_RULES) {
    if (!rule.regex.test(value)) return rule.message;
  }

  return null; // ✅ valid
};

/**
 * Validate that confirmPassword matches password.
 *
 * @param  {string} password        - The primary password value.
 * @param  {string} confirmPassword - The confirmation value.
 * @returns {string|null}  Error message, or null when they match.
 */
const _validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword || typeof confirmPassword !== 'string')
    return 'Please confirm your password.';

  if (confirmPassword !== password) return 'Passwords do not match.';

  return null; // ✅ valid
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef  {Object} ValidationResult
 * @property {boolean}              isValid - True when all checked fields pass.
 * @property {Record<string,string>} errors  - Map of field names to error messages.
 *                                            Empty object when isValid is true.
 */

/**
 * Validate user input for registration or profile update.
 *
 * Context controls which fields are required:
 *  - `'register'`  → firstName, lastName, email, password, confirmPassword are required;
 *                    phone is required only when provided.
 *  - `'update'`    → Only the fields present in `data` are validated (partial update).
 *  - `'login'`     → Only email and password are validated.
 *
 * @param  {Object}                  data             - Raw request body.
 * @param  {string}                 [data.firstName]  - User's first name.
 * @param  {string}                 [data.lastName]   - User's last name.
 * @param  {string}                 [data.email]      - User's email address.
 * @param  {string}                 [data.phone]      - Pakistani mobile number.
 * @param  {string}                 [data.password]   - Plaintext password.
 * @param  {string}                 [data.confirmPassword] - Must match password.
 * @param  {'register'|'update'|'login'} [context='register'] - Validation mode.
 * @returns {ValidationResult}
 *
 * @example
 * const { isValid, errors } = validateUserInput(req.body, 'register');
 * if (!isValid) return res.status(422).json({ success: false, errors });
 */
const validateUserInput = (data = {}, context = 'register') => {
  // Guard: data must be a plain object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      isValid: false,
      errors:  { general: 'Request body must be a JSON object.' },
    };
  }

  /** @type {Record<string,string>} */
  const errors = {};

  // ── LOGIN context — only email + password ──────────────────────────────────
  if (context === 'login') {
    const emailErr = _validateEmail(data.email);
    if (emailErr) errors.email = emailErr;

    if (!data.password) errors.password = 'Password is required.';

    return { isValid: Object.keys(errors).length === 0, errors };
  }

  // ── UPDATE context — only validate keys present in data ───────────────────
  if (context === 'update') {
    if ('firstName' in data) {
      const err = _validateName(data.firstName, 'First name');
      if (err) errors.firstName = err;
    }

    if ('lastName' in data) {
      const err = _validateName(data.lastName, 'Last name');
      if (err) errors.lastName = err;
    }

    if ('email' in data) {
      const err = _validateEmail(data.email);
      if (err) errors.email = err;
    }

    if ('phone' in data && data.phone) {
      const err = _validatePakistaniPhone(data.phone);
      if (err) errors.phone = err;
    }

    if ('password' in data) {
      const err = _validatePassword(data.password);
      if (err) errors.password = err;

      if (!err && 'confirmPassword' in data) {
        const confirmErr = _validateConfirmPassword(data.password, data.confirmPassword);
        if (confirmErr) errors.confirmPassword = confirmErr;
      }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }

  // ── REGISTER context — all fields required ────────────────────────────────

  // First name
  const firstNameErr = _validateName(data.firstName, 'First name');
  if (firstNameErr) {
    errors.firstName = firstNameErr;
    // Early return only when a blocking error prevents further meaningful checks
  }

  // Last name
  const lastNameErr = _validateName(data.lastName, 'Last name');
  if (lastNameErr) errors.lastName = lastNameErr;

  // Email
  const emailErr = _validateEmail(data.email);
  if (emailErr) errors.email = emailErr;

  // Phone (required on register when value is provided; optional if omitted)
  if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
    const phoneErr = _validatePakistaniPhone(data.phone);
    if (phoneErr) errors.phone = phoneErr;
  }

  // Password
  const passwordErr = _validatePassword(data.password);
  if (passwordErr) {
    errors.password = passwordErr;
    // Don't check confirmPassword when password itself is invalid
    return { isValid: false, errors };
  }

  // Confirm password (only reached when password itself is valid)
  const confirmErr = _validateConfirmPassword(data.password, data.confirmPassword);
  if (confirmErr) errors.confirmPassword = confirmErr;

  return { isValid: Object.keys(errors).length === 0, errors };
};

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  validateUserInput,
  // Expose individual validators so they can be unit-tested or reused
  validators: {
    name:            _validateName,
    email:           _validateEmail,
    pakistaniPhone:  _validatePakistaniPhone,
    password:        _validatePassword,
    confirmPassword: _validateConfirmPassword,
  },
};
