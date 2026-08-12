const mongoose = require('mongoose');

// Full lifecycle per the Module 3 correction. Lowercase to match the
// project's existing enum convention (Case.status, Case.priority, etc.).
const HEARING_STATUSES = [
  'scheduled',
  'completed',
  'adjourned',
  'postponed',
  'cancelled',
  'no_appearance',
  'rescheduled',
];

// Statuses a hearing can be *transitioned into* via the lifecycle action
// (hearingController.transitionHearing) — everything except 'scheduled',
// which is only ever the initial state of a newly-created hearing.
const HEARING_TRANSITION_STATUSES = HEARING_STATUSES.filter((s) => s !== 'scheduled');

// hearingType is free-text (curated list suggested by the frontend, not
// enforced as an enum here) so new hearing types don't need a migration —
// same pattern as Case.caseType.

const hearingSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    // Assigned atomically via Case.hearingCounter (see caseController.js /
    // hearingController.js) — guaranteed unique per case even under
    // concurrent creation. Not renumbered on delete; it reflects the actual
    // sequence hearings occurred in, not a live array index.
    hearingNumber: { type: Number, required: true },
    // The date this specific hearing record represents. NEVER overwritten
    // by the adjourn/postpone/reschedule lifecycle action — see
    // transitionHearing in hearingController.js. Only plain `updateHearing`
    // (manual data correction, e.g. fixing a typo) may change this.
    hearingDate: { type: Date, required: [true, 'Hearing date is required'] },
    court: { type: String, trim: true, default: '' },
    judge: { type: String, trim: true, default: '' },
    hearingType: { type: String, required: [true, 'Hearing type is required'], trim: true },
    status: { type: String, enum: HEARING_STATUSES, default: 'scheduled' },
    summary: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    outcome: { type: String, trim: true, default: '' },
    // Reason captured when transitioning to adjourned/postponed/rescheduled.
    adjournmentReason: { type: String, trim: true, default: '' },
    // Informational annotation on THIS hearing about what date was decided
    // next, set at transition time. The actual bookable next hearing is a
    // separate Hearing document (see previousHearingId below) — this field
    // just lets the UI show "next hearing: 30 Aug" on the historical record
    // without a join. Never auto-derived/guessed — only ever set from a
    // user-entered nextHearingDate on the transition request.
    nextHearingDate: { type: Date, default: null },
    nextHearingNotes: { type: String, trim: true, default: '' },
    // Set when this hearing was created as the follow-up to an
    // adjourned/postponed/rescheduled hearing (via transitionHearing or via
    // createHearing's optional previousHearingId). Lets the timeline
    // reconstruct the adjournment chain without guessing.
    previousHearingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hearing', default: null },
    // Soft delete — a hearing is part of case history and is never hard-
    // deleted through the normal DELETE endpoint (see hearingController.js
    // deleteHearing). Excluded from listHearings by default; still directly
    // fetchable by ID so links/references to it keep working. No restore
    // endpoint/UI yet — see PROJECT_MEMORY.md.
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Data-integrity safety net: hearingNumber is actually made unique by the
// atomic Case.hearingCounter increment (see createHearing), which is what
// PREVENTS the race condition. This index CATCHES it too, in case of a bug,
// a manual DB edit, or a migration mistake — createHearing catches the
// E11000 error this would throw and returns a clean 409 rather than a raw
// Mongo error.
hearingSchema.index({ caseId: 1, hearingNumber: 1 }, { unique: true });
hearingSchema.index({ caseId: 1, hearingDate: 1 });
hearingSchema.index({ caseId: 1, status: 1 });

const Hearing = mongoose.model('Hearing', hearingSchema);

module.exports = Hearing;
module.exports.HEARING_STATUSES = HEARING_STATUSES;
module.exports.HEARING_TRANSITION_STATUSES = HEARING_TRANSITION_STATUSES;
