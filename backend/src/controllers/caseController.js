const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Case = require('../models/Case');
const Hearing = require('../models/Hearing');
const CaseEvent = require('../models/CaseEvent');
const { logCaseEvent } = require('../services/caseEventService');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Non-admins only ever see cases they created or are assigned to. */
function scopeToUser(req) {
  if (req.user.role === 'admin') return null;
  return { $or: [{ createdBy: req.user._id }, { assignedUsers: req.user._id }] };
}

// POST /api/cases
const createCase = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    createdBy: req.user._id,
    assignedUsers: [req.user._id],
  };

  const created = await Case.create(payload);

  await logCaseEvent({
    caseId: created._id,
    eventType: 'CASE_CREATED',
    title: 'Case created',
    description: `${created.title} was added to the system.`,
    createdBy: req.user._id,
  });

  return new ApiResponse(201, 'Case created', { case: created }).send(res);
});

// GET /api/cases
const listCases = asyncHandler(async (req, res) => {
  const {
    status,
    isPinned,
    isArchived,
    caseType,
    court,
    priority,
    tags,
    search,
    sort = '-updatedAt',
    page = 1,
    limit = 20,
  } = req.query;

  const andClauses = [];
  const accessScope = scopeToUser(req);
  if (accessScope) andClauses.push(accessScope);

  // Soft-deleted cases never appear in any list view, regardless of other
  // filters — see Case.isDeleted / deleteCase below.
  const filter = { isDeleted: { $ne: true } };
  if (status) filter.status = status;
  if (caseType) filter.caseType = caseType;
  if (priority) filter.priority = priority;
  if (court) filter.court = new RegExp(escapeRegex(court), 'i');
  if (tags) {
    filter.tags = { $in: String(tags).split(',').map((t) => t.trim()).filter(Boolean) };
  }

  // "Archived Cases" is the only view that shows archived cases; every
  // other status/list view hides them, mirroring how archiving works
  // everywhere else (hidden from normal lists, still reachable).
  filter.isArchived = isArchived === 'true';

  if (isPinned === 'true') filter.isPinned = true;

  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    andClauses.push({
      $or: [{ title: re }, { caseNumber: re }, { court: re }, { tags: re }, { 'parties.name': re }],
    });
  }

  if (andClauses.length) filter.$and = andClauses;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const [cases, total] = await Promise.all([
    Case.find({ ...filter }).sort(sort).skip((pageNum - 1) * limitNum).limit(limitNum),
    Case.countDocuments({ ...filter }),
  ]);

  return new ApiResponse(200, 'Cases retrieved', {
    cases,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 1 },
  }).send(res);
});

// GET /api/cases/:id
// Note: loadCase fetches by ID regardless of isDeleted, so a soft-deleted
// case is still directly reachable (e.g. to undelete it) — it just never
// shows up in listCases above.
const getCase = asyncHandler(async (req, res) => {
  const caseDoc = req.case;

  const [hearingCount, lastHearing] = await Promise.all([
    Hearing.countDocuments({ caseId: caseDoc._id, isDeleted: { $ne: true } }),
    Hearing.findOne({ caseId: caseDoc._id, isDeleted: { $ne: true } }).sort('-updatedAt'),
  ]);

  const lastActivity = [caseDoc.updatedAt, lastHearing?.updatedAt]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  return new ApiResponse(200, 'Case retrieved', {
    case: caseDoc,
    stats: {
      hearingCount,
      // Document/evidence pipeline lands in Module 4 — these are real
      // zeros, not placeholders, until that model exists.
      documentCount: 0,
      evidenceCount: 0,
      lastActivity,
    },
  }).send(res);
});

// PUT /api/cases/:id
const updateCase = asyncHandler(async (req, res) => {
  // nextHearingDate is deliberately excluded — it must only ever be written
  // by recalculateNextHearingDate(caseId), derived from real Hearing
  // records. Allowing it here would let a stale/manual value drift away
  // from the actual scheduled hearings. Manage it by managing hearings
  // instead (create/transition/delete a Hearing).
  const allowed = [
    'caseNumber', 'title', 'description', 'caseType', 'court', 'state',
    'jurisdiction', 'priority', 'filingDate', 'tags',
  ];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) req.case[field] = req.body[field];
  });

  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'CASE_UPDATED',
    title: 'Case details updated',
    createdBy: req.user._id,
  });

  return new ApiResponse(200, 'Case updated', { case: req.case }).send(res);
});

// DELETE /api/cases/:id
// Soft delete — sets isDeleted/deletedAt instead of removing the document.
// Hearings, parties, notes, and CaseEvent history are all left intact, per
// "do not permanently destroy historical case information through ordinary
// user actions." Restorable via POST /:id/undelete.
const deleteCase = asyncHandler(async (req, res) => {
  req.case.isDeleted = true;
  req.case.deletedAt = new Date();
  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'CASE_DELETED',
    title: 'Case deleted',
    description: 'Moved out of all case lists. Hearings, parties, and notes were preserved and can be restored.',
    createdBy: req.user._id,
  });

  return new ApiResponse(200, 'Case deleted').send(res);
});

// PATCH /api/cases/:id/undelete
const undeleteCase = asyncHandler(async (req, res) => {
  if (!req.case.isDeleted) {
    throw ApiError.badRequest('Case is not deleted');
  }

  req.case.isDeleted = false;
  req.case.deletedAt = null;
  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'CASE_UNDELETED',
    title: 'Case restored from deletion',
    createdBy: req.user._id,
  });

  return new ApiResponse(200, 'Case restored', { case: req.case }).send(res);
});

// PATCH /api/cases/:id/status
const changeStatus = asyncHandler(async (req, res) => {
  const from = req.case.status;
  req.case.status = req.body.status;
  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'CASE_STATUS_CHANGED',
    title: `Status changed from ${from} to ${req.case.status}`,
    createdBy: req.user._id,
    metadata: { from, to: req.case.status },
  });

  return new ApiResponse(200, 'Status updated', { case: req.case }).send(res);
});

// PATCH /api/cases/:id/archive
const archiveCase = asyncHandler(async (req, res) => {
  req.case.isArchived = true;
  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'CASE_ARCHIVED',
    title: 'Case archived',
    createdBy: req.user._id,
  });

  return new ApiResponse(200, 'Case archived', { case: req.case }).send(res);
});

// PATCH /api/cases/:id/restore
const restoreCase = asyncHandler(async (req, res) => {
  req.case.isArchived = false;
  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'CASE_RESTORED',
    title: 'Case restored from archive',
    createdBy: req.user._id,
  });

  return new ApiResponse(200, 'Case restored', { case: req.case }).send(res);
});

// PATCH /api/cases/:id/pin
const togglePin = asyncHandler(async (req, res) => {
  req.case.isPinned = req.body.isPinned !== undefined ? Boolean(req.body.isPinned) : !req.case.isPinned;
  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: req.case.isPinned ? 'CASE_PINNED' : 'CASE_UNPINNED',
    title: req.case.isPinned ? 'Case pinned' : 'Case unpinned',
    createdBy: req.user._id,
  });

  return new ApiResponse(200, 'Pin updated', { case: req.case }).send(res);
});

// POST /api/cases/:id/parties
const addParty = asyncHandler(async (req, res) => {
  req.case.parties.push(req.body);
  await req.case.save();

  const added = req.case.parties[req.case.parties.length - 1];
  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'PARTY_ADDED',
    title: `Party added: ${added.name} (${added.role})`,
    createdBy: req.user._id,
  });

  return new ApiResponse(201, 'Party added', { case: req.case }).send(res);
});

// PUT /api/cases/:id/parties/:partyId
const updateParty = asyncHandler(async (req, res) => {
  const party = req.case.parties.id(req.params.partyId);
  if (!party) throw ApiError.notFound('Party not found');

  ['name', 'role', 'entityType', 'contact', 'notes'].forEach((field) => {
    if (req.body[field] !== undefined) party[field] = req.body[field];
  });

  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'PARTY_UPDATED',
    title: `Party updated: ${party.name}`,
    createdBy: req.user._id,
  });

  return new ApiResponse(200, 'Party updated', { case: req.case }).send(res);
});

// DELETE /api/cases/:id/parties/:partyId
const deleteParty = asyncHandler(async (req, res) => {
  const party = req.case.parties.id(req.params.partyId);
  if (!party) throw ApiError.notFound('Party not found');

  const partyName = party.name;
  party.deleteOne();
  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'PARTY_REMOVED',
    title: `Party removed: ${partyName}`,
    createdBy: req.user._id,
  });

  return new ApiResponse(200, 'Party removed', { case: req.case }).send(res);
});

// POST /api/cases/:id/notes
const addNote = asyncHandler(async (req, res) => {
  req.case.notes.push({ content: req.body.content, author: req.user._id });
  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'NOTE_ADDED',
    title: 'Note added',
    createdBy: req.user._id,
  });

  return new ApiResponse(201, 'Note added', { case: req.case }).send(res);
});

// PUT /api/cases/:id/notes/:noteId
const updateNote = asyncHandler(async (req, res) => {
  const note = req.case.notes.id(req.params.noteId);
  if (!note) throw ApiError.notFound('Note not found');

  note.content = req.body.content;
  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'NOTE_UPDATED',
    title: 'Note updated',
    createdBy: req.user._id,
  });

  return new ApiResponse(200, 'Note updated', { case: req.case }).send(res);
});

// DELETE /api/cases/:id/notes/:noteId
const deleteNote = asyncHandler(async (req, res) => {
  const note = req.case.notes.id(req.params.noteId);
  if (!note) throw ApiError.notFound('Note not found');

  note.deleteOne();
  await req.case.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'NOTE_DELETED',
    title: 'Note removed',
    createdBy: req.user._id,
  });

  return new ApiResponse(200, 'Note removed', { case: req.case }).send(res);
});

// GET /api/cases/:id/timeline
// Backed by the persisted CaseEvent log rather than derived on the fly —
// preserves full chronology (adjournments, notes, status changes, not just
// hearing creation) and never rewrites history.
const getTimeline = asyncHandler(async (req, res) => {
  const events = await CaseEvent.find({ caseId: req.case._id }).sort('createdAt');
  return new ApiResponse(200, 'Timeline retrieved', { events }).send(res);
});

module.exports = {
  createCase,
  listCases,
  getCase,
  updateCase,
  deleteCase,
  undeleteCase,
  changeStatus,
  archiveCase,
  restoreCase,
  togglePin,
  addParty,
  updateParty,
  deleteParty,
  addNote,
  updateNote,
  deleteNote,
  getTimeline,
};
