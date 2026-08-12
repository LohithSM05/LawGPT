const { body } = require('express-validator');
const { HEARING_STATUSES, HEARING_TRANSITION_STATUSES } = require('../models/Hearing');

const createHearingValidator = [
  body('hearingDate').notEmpty().withMessage('Hearing date is required').isISO8601().withMessage('Hearing date must be a valid date').toDate(),
  body('court').optional({ checkFalsy: true }).trim(),
  body('judge').optional({ checkFalsy: true }).trim(),
  body('hearingType').trim().notEmpty().withMessage('Hearing type is required'),
  body('status').optional().isIn(HEARING_STATUSES).withMessage(`Status must be one of: ${HEARING_STATUSES.join(', ')}`),
  body('summary').optional({ checkFalsy: true }).trim(),
  body('notes').optional({ checkFalsy: true }).trim(),
  body('outcome').optional({ checkFalsy: true }).trim(),
  body('nextHearingDate').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate(),
  body('nextHearingNotes').optional({ checkFalsy: true }).trim(),
  // Set when this hearing is created as an explicit follow-up to an
  // adjourned/postponed hearing (the "Add Next Hearing" action).
  body('previousHearingId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid previous hearing id'),
];

// PUT /hearings/:id — general field edit for correcting genuine data-entry
// mistakes (e.g. a typo in the court name). Deliberately does NOT include
// `status` or `nextHearingDate` — those can only be changed via
// POST /hearings/:id/transition, which preserves history properly (see
// transitionHearing in hearingController.js). This is what stops a plain
// PUT from silently bypassing the guided lifecycle workflow.
const updateHearingValidator = [
  body('hearingDate').optional().isISO8601().withMessage('Hearing date must be a valid date').toDate(),
  body('court').optional({ checkFalsy: true }).trim(),
  body('judge').optional({ checkFalsy: true }).trim(),
  body('hearingType').optional().trim().notEmpty().withMessage('Hearing type cannot be empty'),
  body('summary').optional({ checkFalsy: true }).trim(),
  body('notes').optional({ checkFalsy: true }).trim(),
  body('outcome').optional({ checkFalsy: true }).trim(),
  body('adjournmentReason').optional({ checkFalsy: true }).trim(),
];

/**
 * For POST /hearings/:id/transition — the guided lifecycle action (Mark
 * Completed / Adjourn / Postpone / Cancel / Reschedule / No Appearance).
 * Deliberately excludes 'scheduled' as a target: that's only ever the
 * initial state of a brand-new hearing, not something you transition into.
 */
const transitionHearingValidator = [
  body('status')
    .isIn(HEARING_TRANSITION_STATUSES)
    .withMessage(`Status must be one of: ${HEARING_TRANSITION_STATUSES.join(', ')}`),
  body('adjournmentReason').optional({ checkFalsy: true }).trim(),
  body('outcome').optional({ checkFalsy: true }).trim(),
  body('notes').optional({ checkFalsy: true }).trim(),
  // If the court has genuinely not given a new date yet, this stays empty —
  // never inferred or defaulted.
  body('nextHearingDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Next hearing date must be a valid date').toDate(),
  body('nextHearingNotes').optional({ checkFalsy: true }).trim(),
];

module.exports = { createHearingValidator, updateHearingValidator, transitionHearingValidator };
