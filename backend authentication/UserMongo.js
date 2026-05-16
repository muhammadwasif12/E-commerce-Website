/**
 * ============================================================
 * USER MODEL — MongoDB / Mongoose
 * ============================================================
 * NOTE: Password hashing is intentionally handled in the
 * controller (bcrypt.hash) before calling User.create().
 * The pre-save hook below acts as an additional safety net
 * for direct model-level saves that bypass the controller.
 * ============================================================
 */

'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const SALT_ROUNDS = 12;

// ─── Sub-document: Address ─────────────────────────────────────────────────
const addressSchema = new mongoose.Schema(
  {
    label:      { type: String, enum: ['home', 'work', 'other'], default: 'home' },
    line1:      { type: String, required: true, trim: true },
    line2:      { type: String, trim: true },
    city:       { type: String, required: true, trim: true },
    state:      { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country:    { type: String, required: true, trim: true, default: 'PK' },
    isDefault:  { type: Boolean, default: false },
  },
  { _id: true, timestamps: false }
);

// ─── Main User Schema ──────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // ── Personal Info ──────────────────────────────────────────────────────
    firstName: {
      type:     String,
      required: [true, 'First name is required'],
      trim:     true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type:     String,
      required: [true, 'Last name is required'],
      trim:     true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    avatar: {
      type:    String,      // URL to profile picture
      default: null,
    },

    // ── Contact ────────────────────────────────────────────────────────────
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type:    String,
      unique:  true,
      sparse:  true,           // allows multiple null values
      trim:    true,
      match:   [/^\+?[\d\s\-().]{7,20}$/, 'Please provide a valid phone number'],
    },

    // ── Auth ───────────────────────────────────────────────────────────────
    password: {
      type:     String,
      required: [true, 'Password is required'],
      select:   false,         // never returned in queries by default
      minlength: [8, 'Password must be at least 8 characters'],
    },
    role: {
      type:    String,
      enum:    { values: ['customer', 'vendor', 'admin'], message: 'Invalid role' },
      default: 'customer',
    },

    // ── Verification ───────────────────────────────────────────────────────
    isVerified: {
      type:    Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type:    Date,
      default: null,
    },
    phoneVerifiedAt: {
      type:    Date,
      default: null,
    },

    // ── Account Status ─────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
    },
    lastLoginAt: {
      type:    Date,
      default: null,
    },
    passwordChangedAt: {
      type:    Date,
      default: null,
    },

    // ── Addresses (embedded) ───────────────────────────────────────────────
    addresses: [addressSchema],

    // ── Preferences ────────────────────────────────────────────────────────
    preferences: {
      currency:       { type: String, default: 'PKR' },
      language:       { type: String, default: 'en' },
      emailNotifications: { type: Boolean, default: true },
      smsNotifications:   { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,        // createdAt, updatedAt
    toJSON:     { virtuals: true, versionKey: false },
    toObject:   { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ─── Pre-save Hook (safety net) ───────────────────────────────────────────
// Hashes plain-text passwords set directly on the model instance.
userSchema.pre('save', async function (next) {
  // Only hash when password field was actually modified and looks un-hashed
  if (!this.isModified('password')) return next();
  if (this.password && this.password.startsWith('$2b$')) return next(); // already hashed

  try {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────

/**
 * Compare a plain-text candidate against the stored hash.
 * Usage: const ok = await user.comparePassword('secret');
 */
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/**
 * Check if the password was changed AFTER the given JWT iat timestamp.
 * Useful for invalidating tokens issued before a password reset.
 */
userSchema.methods.passwordChangedAfter = function (jwtIssuedAt) {
  if (this.passwordChangedAt) {
    const changedTs = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return jwtIssuedAt < changedTs;
  }
  return false;
};

// ─── Static Methods ───────────────────────────────────────────────────────

/**
 * Find an active, verified user by email (includes password field).
 */
userSchema.statics.findByEmailForAuth = function (email) {
  return this.findOne({
    email:    email.toLowerCase().trim(),
    isActive: true,
  }).select('+password');
};

const User = mongoose.model('User', userSchema);

module.exports = User;
