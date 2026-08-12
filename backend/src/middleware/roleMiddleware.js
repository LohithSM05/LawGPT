const ApiError = require('../utils/ApiError');

/**
 * Restricts a route to specific roles. Must run after `protect` so
 * req.user is already set.
 *
 *   router.delete('/cases/:id', protect, authorize('admin', 'lawyer'), ...)
 */
function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action requires one of the following roles: ${allowedRoles.join(', ')}`));
    }
    next();
  };
}

module.exports = { authorize };
