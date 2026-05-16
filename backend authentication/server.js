require('dotenv').config({ path: '.env' }); // Load env variables if present locally
const app = require('./app');
const connectMongoDB = require('./mongoConnection');
const logger = require('./logger');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectMongoDB();

    // 2. Start the Express App
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
