/**
 * Wraps an async route handler so thrown errors / rejected promises are
 * forwarded to next(err) instead of crashing the process or hanging the
 * request. Avoids repeating try/catch in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
