const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Hearing = require('../models/Hearing');
const Case = require('../models/Case');
const { logCaseEvent } = require('../services/caseEventService');
const { recalculateNextHearingDate } = require('../services/hearingSchedulingService');

const TRANSITION_EVENT_TYPE = {
  completed: 'HEARING_COMPLETED',
  adjourned: 'HEARING_ADJOURNED',
  postponed: 'HEARING_POSTPONED',
  cancelled: 'HEARING_CANCELLED',
  rescheduled: 'HEARING_RESCHEDULED',
  no_appearance: 'HEARING_NO_APPEARANCE',
};

/**
 * Atomically claims the next hearingNumber for a case via $inc, so two
 * concurrent "add hearing" requests can never compute the same number —
 * unlike counting existing documents and adding 1, which races. The unique
 * {caseId, hearingNumber} index on Hearing is a safety net on top of this,
 * not the primary defense.
 */
async function claimNextHearingNumber(caseId) {
  const updatedCase = await Case.findByIdAndUpdate(caseId, { $inc: { hearingCounter: 1 } }, { new: true }).select(
    '+hearingCounter'
  );
  return updatedCase.hearingCounter;
}

/** Wraps Hearing.create so a (should-be-impossible) duplicate-key hit from
 * the unique index comes back as a clean, actionable API error instead of a
 * raw Mongo exception. */
async function createHearingSafely(payload) {
  try {
    return await Hearing.create(payload);
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict('A hearing with this number already exists for this case. Please try again.');
    }
    throw err;
  }
}

// POST /api/cases/:caseId/hearings
const createHearing = asyncHandler(async (req, res) => {
  const { previousHearingId, ...hearingData } = req.body;

  const hearingNumber = await claimNextHearingNumber(req.case._id);

  const hearing = await createHearingSafely({
    ...hearingData,
    caseId: req.case._id,
    hearingNumber,
    previousHearingId: previousHearingId || null,
    createdBy: req.user._id,
  });

  await logCaseEvent({
    caseId: req.case._id,
    hearingId: hearing._id,
    eventType: previousHearingId ? 'NEXT_HEARING_SCHEDULED' : 'HEARING_CREATED',
    title: previousHearingId
      ? `Hearing #${hearing.hearingNumber} scheduled as the next hearing`
      : `Hearing #${hearing.hearingNumber} added`,
    description: hearing.hearingType,
    createdBy: req.user._id,
  });

  await recalculateNextHearingDate(req.case._id);

  return new ApiResponse(201, 'Hearing added', { hearing }).send(res);
});

// GET /api/cases/:caseId/hearings
// Excludes soft-deleted hearings — see deleteHearing below.
const listHearings = asyncHandler(async (req, res) => {
  const hearings = await Hearing.find({ caseId: req.case._id, isDeleted: { $ne: true } }).sort('hearingDate');
  return new ApiResponse(200, 'Hearings retrieved', { hearings }).send(res);
});

// GET /api/cases/:caseId/hearings/:hearingId
// Deliberately does NOT exclude soft-deleted hearings — this is direct,
// by-ID access (e.g. following a previousHearingId link or a Timeline
// entry), not a list. A deleted hearing should still be viewable for
// historical context; it just won't appear in listHearings above.
const getHearing = asyncHandler(async (req, res) => {
  const hearing = await Hearing.findOne({ _id: req.params.hearingId, caseId: req.case._id }).populate(
    'previousHearingId',
    'hearingNumber hearingDate status'
  );
  if (!hearing) throw ApiError.notFound('Hearing not found');
  return new ApiResponse(200, 'Hearing retrieved', { hearing }).send(res);
});

// PUT /api/cases/:caseId/hearings/:hearingId — general field edit, for
// correcting a genuine data-entry mistake (e.g. a typo in the court name).
// Deliberately excludes `status` and `nextHearingDate` from the allowed
// fields — those can only change via POST .../transition below, which is
// what keeps the guided lifecycle workflow from being bypassed. A
// soft-deleted hearing can't be edited (treated as not-found) — it's read
// via getHearing but not mutated.
const updateHearing = asyncHandler(async (req, res) => {
  const hearing = await Hearing.findOne({ _id: req.params.hearingId, caseId: req.case._id, isDeleted: { $ne: true } });
  if (!hearing) throw ApiError.notFound('Hearing not found');

  const allowed = ['hearingDate', 'court', 'judge', 'hearingType', 'summary', 'notes', 'outcome', 'adjournmentReason'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) hearing[field] = req.body[field];
  });

  await hearing.save();

  await logCaseEvent({
    caseId: req.case._id,
    hearingId: hearing._id,
    eventType: 'HEARING_UPDATED',
    title: `Hearing #${hearing.hearingNumber} updated`,
    createdBy: req.user._id,
  });

  await recalculateNextHearingDate(req.case._id);

  return new ApiResponse(200, 'Hearing updated', { hearing }).send(res);
});

// POST /api/cases/:caseId/hearings/:hearingId/transition
// The ONLY path that can change a hearing's status or its nextHearingDate —
// the guided action behind Mark Completed / Adjourn / Postpone / Cancel /
// Reschedule / No Appearance. This hearing's own `hearingDate` is NEVER
// changed here — only status/outcome/notes/reason. If the caller supplies
// an explicit nextHearingDate, a SEPARATE new Hearing document is created
// for it (status 'scheduled', linked via previousHearingId) rather than
// overwriting this one — that's what keeps the historical date intact.
// Excludes soft-deleted hearings from being transitioned, same as updateHearing.
const transitionHearing = asyncHandler(async (req, res) => {
  const hearing = await Hearing.findOne({ _id: req.params.hearingId, caseId: req.case._id, isDeleted: { $ne: true } });
  if (!hearing) throw ApiError.notFound('Hearing not found');

  const { status, adjournmentReason, outcome, notes, nextHearingDate, nextHearingNotes } = req.body;

  hearing.status = status;
  if (adjournmentReason !== undefined) hearing.adjournmentReason = adjournmentReason;
  if (outcome !== undefined) hearing.outcome = outcome;
  if (notes !== undefined) hearing.notes = notes;
  if (nextHearingDate !== undefined) hearing.nextHearingDate = nextHearingDate;
  if (nextHearingNotes !== undefined) hearing.nextHearingNotes = nextHearingNotes;
  await hearing.save();

  await logCaseEvent({
    caseId: req.case._id,
    hearingId: hearing._id,
    eventType: TRANSITION_EVENT_TYPE[status] || 'HEARING_UPDATED',
    title: `Hearing #${hearing.hearingNumber} marked ${status.replace('_', ' ')}`,
    description: adjournmentReason || outcome || '',
    createdBy: req.user._id,
  });

  let newHearing = null;

  // Only create a follow-up hearing if the user explicitly entered a date —
  // never inferred, never defaulted, never carried over automatically.
  if (nextHearingDate && ['adjourned', 'postponed', 'rescheduled'].includes(status)) {
    const hearingNumber = await claimNextHearingNumber(req.case._id);

    newHearing = await createHearingSafely({
      caseId: req.case._id,
      hearingNumber,
      hearingDate: nextHearingDate,
      hearingType: hearing.hearingType,
      court: hearing.court,
      judge: hearing.judge,
      notes: nextHearingNotes || '',
      status: 'scheduled',
      previousHearingId: hearing._id,
      createdBy: req.user._id,
    });

    await logCaseEvent({
      caseId: req.case._id,
      hearingId: newHearing._id,
      eventType: 'NEXT_HEARING_SCHEDULED',
      title: `Hearing #${newHearing.hearingNumber} scheduled for ${new Date(nextHearingDate).toLocaleDateString()}`,
      description: nextHearingNotes || '',
      createdBy: req.user._id,
    });
  }

  await recalculateNextHearingDate(req.case._id);

  return new ApiResponse(200, 'Hearing status updated', { hearing, newHearing }).send(res);
});

// DELETE /api/cases/:caseId/hearings/:hearingId
// Soft delete — a court hearing is part of case history and is never
// permanently destroyed through this normal endpoint. Sets isDeleted/
// deletedAt instead of removing the document. This automatically preserves
// everything the correction requires: the CaseEvent history is untouched
// (nothing was ever deleted from that collection), later hearingNumbers are
// never renumbered (unaffected either way — deletion never renumbered
// anything), previousHearingId links from other hearings stay valid (the
// document they point to still exists), and Case.nextHearingDate is
// recalculated below. No restore endpoint/UI yet — see PROJECT_MEMORY.md.
const deleteHearing = asyncHandler(async (req, res) => {
  const hearing = await Hearing.findOne({ _id: req.params.hearingId, caseId: req.case._id, isDeleted: { $ne: true } });
  if (!hearing) throw ApiError.notFound('Hearing not found');

  hearing.isDeleted = true;
  hearing.deletedAt = new Date();
  await hearing.save();

  await logCaseEvent({
    caseId: req.case._id,
    hearingId: hearing._id,
    eventType: 'HEARING_DELETED',
    title: `Hearing #${hearing.hearingNumber} deleted`,
    createdBy: req.user._id,
  });

  await recalculateNextHearingDate(req.case._id);

  return new ApiResponse(200, 'Hearing deleted').send(res);
});

module.exports = { createHearing, listHearings, getHearing, updateHearing, transitionHearing, deleteHearing };
