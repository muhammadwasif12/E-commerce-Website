// jest.config.js
'use strict';

module.exports = {
  // Use Node.js environment (no DOM)
  testEnvironment: 'node',

  // Root for test discovery
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js',
  ],

  // Global setup / teardown
  globalSetup:    './__tests__/globalSetup.js',
  globalTeardown: './__tests__/globalTeardown.js',

  // Per-file setup (runs in test VM context so mocks work)
  setupFilesAfterEnv: ['./__tests__/setup.js'],

  // Generous timeout for mongodb-memory-server startup
  testTimeout: 30_000,

  // Coverage
  collectCoverage: false,   // run with --coverage flag when needed
  collectCoverageFrom: [
    '*.js',
    '!jest.config.js',
    '!__tests__/**',
    '!node_modules/**',
  ],
  coverageDirectory: '__tests__/coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Clear mocks automatically between tests
  clearMocks:   true,
  resetMocks:   false,   // keep mock implementations (reset per describe in setup)
  restoreMocks: false,

  // Verbose output
  verbose: true,
};
