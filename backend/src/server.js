const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const logger = require('./utils/logger');
const { startDocumentWorker, stopDocumentWorker } = require('./services/documentPipelineService');

async function start() {
  await connectDB();

  // Module 4 Phase 2 — starts the MongoDB-polled document processing worker
  // (pending documents are pushed through extraction/OCR/chunking/embeddings
  // via the python-ai service).
  startDocumentWorker();

  const server = app.listen(env.port, () => {
    logger.info(`LawGPT backend listening on port ${env.port} [${env.nodeEnv}]`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    stopDocumentWorker();
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
