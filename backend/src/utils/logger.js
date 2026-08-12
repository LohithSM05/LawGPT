const winston = require('winston');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isProd ? winston.format.json() : winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level}]: ${stack || message}`;
      })
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
    }),
  ],
  exitOnError: false,
});

// morgan can stream HTTP access logs through this same logger
logger.stream = {
  write: (message) => logger.http ? logger.http(message.trim()) : logger.info(message.trim()),
};

module.exports = logger;
