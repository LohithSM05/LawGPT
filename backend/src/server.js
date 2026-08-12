const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const logger = require('./utils/logger');

async function start() {
  await connectDB();

  const server = app.listen(env.port, () => {
    logger.info(`LawGPT backend listening on port ${env.port} [${env.nodeEnv}]`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
  });
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.stack || err}`);
    process.exit(1);
  });
}

start();
