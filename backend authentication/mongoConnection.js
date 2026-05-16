'use strict';

/**
 * ============================================================
 * MongoDB Connection — Mongoose
 * ============================================================
 * Call connectMongoDB() once at app startup (before listening).
 *
 * Features:
 *  - Retries indefinitely with exponential back-off (max 30s)
 *  - Logs connection lifecycle events
 *  - Graceful shutdown on SIGINT / SIGTERM
 * ============================================================
 */

const mongoose = require('mongoose');
const logger   = require('./logger');

// ─── Connection Options ───────────────────────────────────────────────────────
const MONGOOSE_OPTIONS = {
  // Keep connection alive
  serverSelectionTimeoutMS: 10_000,   // fail fast if no server reachable
  socketTimeoutMS:          45_000,
  // Connection pool
  maxPoolSize:              10,
  minPoolSize:              2,
};

// ─── Lifecycle Events ─────────────────────────────────────────────────────────
mongoose.connection.on('connected', () => {
  logger.info('✅ MongoDB connected', { db: mongoose.connection.name });
});

mongoose.connection.on('error', (err) => {
  logger.error('❌ MongoDB connection error', { err });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️  MongoDB disconnected');
});

// ─── Main Connect Function ────────────────────────────────────────────────────
const connectMongoDB = async (retryCount = 0) => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    logger.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, MONGOOSE_OPTIONS);
  } catch (err) {
    const MAX_BACKOFF_MS = 30_000;
    const delay = Math.min(1_000 * 2 ** retryCount, MAX_BACKOFF_MS);

    logger.error(`MongoDB connection failed (attempt ${retryCount + 1}). Retrying in ${delay / 1000}s…`, {
      message: err.message,
    });

    await new Promise((resolve) => setTimeout(resolve, delay));
    return connectMongoDB(retryCount + 1);
  }
};

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received — closing MongoDB connection…`);
  await mongoose.connection.close();
  logger.info('MongoDB connection closed. Exiting.');
  process.exit(0);
};

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = connectMongoDB;
