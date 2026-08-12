const { body, validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../models/User');

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=~`[\]/\\;']).{8,}$/;

const registerValidator = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Enter a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .matches(PASSWORD_REGEX)
    .withMessage(
      'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character'
    ),

  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your password')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),

  body('role')
    .optional()
    .isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
];

const loginValidator = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  body('rememberMe').optional().isBoolean().toBoolean(),
];

/** Runs after a validator chain; throws a formatted 422 if anything failed. */
function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(ApiError.unprocessable('Validation failed', errors));
}

module.exports = { registerValidator, loginValidator, validate, PASSWORD_REGEX };
