const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const tokenService = require('../services/tokenService');
const User = require('../models/User');

/** Requires a valid `Authorization: Bearer <accessToken>` header. */
const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('No access token provided');
  }

  const token = header.split(' ')[1];

  let payload;
  try {
    payload = tokenService.verifyAccessToken(token);
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token';
    throw ApiError.unauthorized(message);
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('User account no longer exists');
  }

  req.user = user;
  next();
});

module.exports = { protect };
