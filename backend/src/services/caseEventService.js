const CaseEvent = require('../models/CaseEvent');

/**
 * Fire-and-forget-ish event logging. Awaited by callers (so a genuine DB
 * error surfaces), but never blocks the primary action's response shape —
 * callers call this after the main mutation already succeeded.
 */
async function logCaseEvent({ caseId, hearingId = null, eventType, title, description = '', createdBy, metadata = {} }) {
  return CaseEvent.create({ caseId, hearingId, eventType, title, description, createdBy, metadata });
}

module.exports = { logCaseEvent };
