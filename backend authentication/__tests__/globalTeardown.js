// __tests__/globalTeardown.js
// Runs ONCE after all test suites. Stops the in-memory MongoDB server.
'use strict';

module.exports = async () => {
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
};
