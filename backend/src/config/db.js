const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

async function connectDB() {
  mongoose.set('strictQuery', true);

  try {
    const conn = await mongoose.connect(env.mongoUri);
    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB error: ${err.message}`);
  });
}

module.exports = connectDB;
