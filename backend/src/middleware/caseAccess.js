const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Case = require('../models/Case');

/** Loads a Case from :id (caseRoutes) or :caseId (nested hearingRoutes) onto req.case. */
const loadCase = asyncHandler(async (req, _res, next) => {
  const caseId = req.params.caseId || req.params.id;
  const found = await Case.findById(caseId);
  if (!found) {
    throw ApiError.notFound('Case not found');
  }
  req.case = found;
  next();
});

/**
 * Restricts access to the case's creator, its assigned users, or an admin.
 * Must run after `protect` (needs req.user) and `loadCase` (needs req.case).
 */
function requireCaseAccess(req, _res, next) {
  const userId = req.user._id.toString();
  const isOwner = req.case.createdBy.toString() === userId;
  const isAssigned = req.case.assignedUsers.some((u) => u.toString() === userId);
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAssigned && !isAdmin) {
    return next(ApiError.forbidden('You do not have access to this case'));
  }
  next();
}

module.exports = { loadCase, requireCaseAccess };
