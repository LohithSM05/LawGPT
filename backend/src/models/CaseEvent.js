const mongoose = require('mongoose');

/**
 * Initial set per the Module 3 correction, plus a few pragmatic additions
 * for lifecycle actions that already exist in this module (party/note
 * edits, pin, case update, soft-delete) — logging those consistently is
 * what makes "what changed and when" actually answerable later, which is
 * the whole point of this model. Deliberately NOT adding placeholder types
 * for subsystems that don't exist yet (DOCUMENT_ADDED, EVIDENCE_ADDED,
 * AI_ANALYSIS_CREATED, etc.) — those get added when their module lands.
 */
const EVENT_TYPES = [
  'CASE_CREATED',
  'CASE_UPDATED',
  'CASE_STATUS_CHANGED',
  'CASE_ARCHIVED',
  'CASE_RESTORED',
  'CASE_DELETED',
  'CASE_UNDELETED',
  'CASE_PINNED',
  'CASE_UNPINNED',
  'PARTY_ADDED',
  'PARTY_UPDATED',
  'PARTY_REMOVED',
  'NOTE_ADDED',
  'NOTE_UPDATED',
  'NOTE_DELETED',
  'HEARING_CREATED',
  'HEARING_UPDATED',
  'HEARING_COMPLETED',
  'HEARING_ADJOURNED',
  'HEARING_POSTPONED',
  'HEARING_CANCELLED',
  'HEARING_RESCHEDULED',
  'HEARING_NO_APPEARANCE',
  'HEARING_DELETED',
  'NEXT_HEARING_SCHEDULED',
];

const caseEventSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    hearingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hearing', default: null },
    eventType: { type: String, enum: EVENT_TYPES, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Free-form extra context per event (e.g. { from: 'ongoing', to: 'won' }
    // for CASE_STATUS_CHANGED). Mixed/untyped on purpose — every event type
    // has a different shape, and this isn't queried structurally, only
    // displayed.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  // Events are an immutable log — no updatedAt, they're never edited.
  { timestamps: { createdAt: true, updatedAt: false } }
);

caseEventSchema.index({ caseId: 1, createdAt: 1 });

const CaseEvent = mongoose.model('CaseEvent', caseEventSchema);

module.exports = CaseEvent;
module.exports.EVENT_TYPES = EVENT_TYPES;
