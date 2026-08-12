const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function generateAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}

/**
 * Refresh tokens are JWTs (so expiry/signature are self-verifying) that also
 * embed a random jti. Only a SHA-256 hash of the token is stored on the user
 * document, so verifying a refresh request means: (1) JWT signature/expiry
 * check, then (2) hash(token) === stored hash. A mismatch after a valid
 * signature means the token was already rotated out — treated as possible
 * reuse and the session is killed.
 */
function generateRefreshToken(user) {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({ sub: user._id.toString(), jti }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
  return token;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret); // throws on invalid/expired
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret); // throws on invalid/expired
}

/** Converts a "15m" / "7d" style duration into milliseconds for cookie maxAge. */
function durationToMs(duration) {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unit;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyAccessToken,
  verifyRefreshToken,
  durationToMs,
};
