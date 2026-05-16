// __tests__/globalSetup.js
// Runs ONCE before all test suites in a separate process.
// Starts mongodb-memory-server and stores the URI in process.env.
'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI        = mongod.getUri();
  process.env.JWT_SECRET         = 'test_jwt_secret_supersecure_64chars_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_supersecure_64chars_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  process.env.JWT_EXPIRE         = '15m';
  process.env.JWT_REFRESH_EXPIRE = '7d';
  process.env.NODE_ENV           = 'test';

  // Make the server instance available to globalTeardown
  global.__MONGOD__ = mongod;
};
