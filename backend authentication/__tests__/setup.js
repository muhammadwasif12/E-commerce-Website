// __tests__/setup.js
// Runs inside each test VM context after the test framework is installed.
// Connects Mongoose to the in-memory server, wires up Redis mock store.
'use strict';

const mongoose = require('mongoose');

// ─── Connect Mongoose before any test in this file runs ───────────────────────
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
  }
});

// ─── Drop all collections between test files (clean slate) ────────────────────
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

// ─── Disconnect after all tests in this suite finish ─────────────────────────
afterAll(async () => {
  await mongoose.disconnect();
});
