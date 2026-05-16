require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const app = require('./app');
const logger = require('./logger');

// 4. PORT handling
const PORT = process.env.PORT || 5000;

// 2. Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// 1. MongoDB connection with RETRY logic
const connectWithRetry = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error('❌ MONGODB_URI is missing. Database will not connect.');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, 
      socketTimeoutMS: 45000,
    });
    // 5. Log MongoDB connection status
    logger.info('✅ MongoDB connected successfully'); 
  } catch (error) {
    // 5. Log any errors
    logger.error(`❌ MongoDB connection failed: ${error.message}`); 
    logger.info('⏳ Retrying MongoDB connection in 5 seconds...');
    // Retry after 5 seconds
    setTimeout(connectWithRetry, 5000); 
  }
};

let server;

const startServer = () => {
  // Start the server FIRST so Railway sees the port bound immediately
  server = app.listen(PORT, '0.0.0.0', () => {
    // 5. Log when server starts
    logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'production'} mode`); 
  });

  // Start MongoDB connection in the background (Don't crash on DB error)
  connectWithRetry();
};

// Initialize application
startServer();

// 3. Graceful error handling - Process uncaught exceptions and don't exit
process.on('uncaughtException', (error) => {
  logger.error('⚠️ Uncaught Exception:', error);
  // We do not crash/exit the app here so Railway keeps running
});

process.on('unhandledRejection', (error) => {
  logger.error('⚠️ Unhandled Rejection:', error);
  // We do not crash/exit the app here so Railway keeps running
});

process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received - shutting down gracefully');
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  }
});
