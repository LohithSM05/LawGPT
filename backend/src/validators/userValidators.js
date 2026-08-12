const { body } = require('express-validator');

const updateProfileValidator = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters'),

  body('avatar')
    .optional({ checkFalsy: true })
    .isURL().withMessage('Avatar must be a valid URL'),
];

module.exports = { updateProfileValidator };
