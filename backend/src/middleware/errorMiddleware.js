const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let { statusCode, message, errors } = err;

  // Known Mongo/Mongoose failure shapes get mapped to clean operational errors
  // instead of leaking driver internals to the client.
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || { field: 1 })[0];
    message = `An account with this ${field} already exists`;
  } else if (err.name === 'ValidationError') {
    statusCode = 422;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = 'Validation failed';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.name === 'MulterError') {
    // File upload errors from the Module 4 multer pipeline (oversized file,
    // too many files, wrong field name) map to clean 400s instead of 500s.
    statusCode = 400;
    const codeMessages = {
      LIMIT_FILE_SIZE: 'File too large',
      LIMIT_FILE_COUNT: 'Too many files in a single request',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
    };
    message = codeMessages[err.code] || `File upload failed: ${err.code}`;
  }

  statusCode = statusCode || 500;
  message = message || 'Internal server error';

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}: ${err.stack || message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode}: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(errors && errors.length ? { errors } : {}),
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { notFound, errorHandler };
