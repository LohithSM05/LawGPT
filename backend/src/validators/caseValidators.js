const { body } = require('express-validator');
const { CASE_STATUSES, CASE_PRIORITIES } = require('../models/Case');

const baseCaseFields = [
  body('caseNumber').trim().notEmpty().withMessage('Case number is required'),
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title is too long'),
  body('caseType').trim().notEmpty().withMessage('Case type is required'),
  body('description').optional({ checkFalsy: true }).trim(),
  body('court').optional({ checkFalsy: true }).trim(),
  body('state').optional({ checkFalsy: true }).trim(),
  body('jurisdiction').optional({ checkFalsy: true }).trim(),
  body('priority').optional().isIn(CASE_PRIORITIES).withMessage(`Priority must be one of: ${CASE_PRIORITIES.join(', ')}`),
  body('filingDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Filing date must be a valid date').toDate(),
  body('tags').optional().isArray().withMessage('Tags must be a list'),
  body('tags.*').optional().isString().trim(),
];

const createCaseValidator = baseCaseFields;

// Same shape, but every field is optional since an update may only touch one field.
const updateCaseValidator = [
  body('caseNumber').optional().trim().notEmpty().withMessage('Case number cannot be empty'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 200 }),
  body('caseType').optional().trim().notEmpty().withMessage('Case type cannot be empty'),
  body('description').optional({ checkFalsy: true }).trim(),
  body('court').optional({ checkFalsy: true }).trim(),
  body('state').optional({ checkFalsy: true }).trim(),
  body('jurisdiction').optional({ checkFalsy: true }).trim(),
  body('priority').optional().isIn(CASE_PRIORITIES),
  body('filingDate').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate(),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString().trim(),
];

const changeStatusValidator = [
  body('status').isIn(CASE_STATUSES).withMessage(`Status must be one of: ${CASE_STATUSES.join(', ')}`),
];

const partyValidator = [
  body('name').trim().notEmpty().withMessage('Party name is required'),
  body('role').trim().notEmpty().withMessage('Party role is required'),
  body('entityType').optional().isIn(['person', 'organization']),
  body('contact').optional({ checkFalsy: true }).trim(),
  body('notes').optional({ checkFalsy: true }).trim(),
];

const noteValidator = [body('content').trim().notEmpty().withMessage('Note content is required')];

module.exports = {
  createCaseValidator,
  updateCaseValidator,
  changeStatusValidator,
  partyValidator,
  noteValidator,
};
