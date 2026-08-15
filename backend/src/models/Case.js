const mongoose = require('mongoose');

/**
 * `status` is deliberately 4 values, not 5. The product spec lists
 * Ongoing/Won/Lost/Closed/Archived as "case status", but also asks for a
 * separate `isArchived` boolean plus explicit Archive/Restore actions. Two
 * archival mechanisms fighting each other (a status value AND a boolean)
 * makes "restore" ambiguous — restore to what prior status? Keeping
 * `status` to the 4 real outcomes and `isArchived` as an orthogonal flag
 * means restore is just isArchived:false, and any status can be archived
 * without losing its outcome. See PROJECT_MEMORY.md decisions log.
 */
const CASE_STATUSES = ['ongoing', 'won', 'lost', 'transferred', 'closed'];
const CASE_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// caseType and party.role are intentionally free-text (see below), not
// Mongoose enums — the spec requires these to be extensible without a
// migration. The frontend suggests a curated list from
// frontend/src/config/caseOptions.js and lets the user type a custom value.

const partySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Party name is required'], trim: true },
    role: { type: String, required: [true, 'Party role is required'], trim: true },
    entityType: { type: String, enum: ['person', 'organization'], default: 'person' },
    contact: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

const noteSchema = new mongoose.Schema(
  {
    content: { type: String, required: [true, 'Note content is required'], trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const caseSchema = new mongoose.Schema(
  {
    caseNumber: { type: String, required: [true, 'Case number is required'], trim: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200 },
    description: { type: String, trim: true, default: '' },
    caseType: { type: String, required: [true, 'Case type is required'], trim: true },
    court: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    jurisdiction: { type: String, trim: true, default: '' },
    status: { type: String, enum: CASE_STATUSES, default: 'ongoing' },
    priority: { type: String, enum: CASE_PRIORITIES, default: 'medium' },
    filingDate: { type: Date, default: null },
    // Kept in sync from the most relevant Hearing whenever one is
    // created/updated with a nextHearingDate — see hearingController.js.
    nextHearingDate: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    parties: [partySchema],
    notes: [noteSchema],
    tags: [{ type: String, trim: true }],
    isPinned: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    // Soft-delete: DELETE /api/cases/:id sets these instead of removing the
    // document (see caseController.deleteCase). Preserves case history —
    // hearings, parties, notes, and CaseEvent records all survive. Excluded
    // from listCases by default; still directly fetchable by ID (so an
    // undelete flow has something to restore). See PROJECT_MEMORY.md.
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    // Atomically incremented by createHearing to assign each new hearing a
    // unique-within-this-case hearingNumber, avoiding the race condition
    // where two concurrent requests both read the same "count so far" and
    // compute the same next number. Internal bookkeeping — not meant to be
    // read/written directly outside hearingController.js.
    hearingCounter: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

// Case numbers only need to be unique per-user, not globally — different
// users may legitimately track cases from different courts/registries that
// happen to share a number format.
caseSchema.index({ createdBy: 1, caseNumber: 1 }, { unique: true });
caseSchema.index({ createdBy: 1, status: 1, isArchived: 1 });
caseSchema.index({ assignedUsers: 1 });

const Case = mongoose.model('Case', caseSchema);

module.exports = Case;
module.exports.CASE_STATUSES = CASE_STATUSES;
module.exports.CASE_PRIORITIES = CASE_PRIORITIES;
