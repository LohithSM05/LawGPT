const Case = require('../models/Case');
const Hearing = require('../models/Hearing');

/**
 * Recomputes Case.nextHearingDate from scratch: the earliest *future*,
 * *scheduled* hearing that exists for this case, or null if there is none.
 *
 * This is the ONLY place nextHearingDate gets written. It never guesses —
 * it only reflects a hearingDate the user explicitly entered on a hearing
 * whose status is still 'scheduled'. Call this after every hearing
 * create/update/delete/status-transition so the field can't go stale.
 *
 * "Future" means strictly after the moment this runs — a scheduled hearing
 * whose date has already passed (e.g. nobody updated its status yet) is not
 * a valid "next hearing" and is excluded.
 */
async function recalculateNextHearingDate(caseId) {
  const nextHearing = await Hearing.findOne({
    caseId,
    status: 'scheduled',
    isDeleted: { $ne: true },
    hearingDate: { $gte: new Date() },
  }).sort('hearingDate');

  const nextDate = nextHearing ? nextHearing.hearingDate : null;

  await Case.findByIdAndUpdate(caseId, { nextHearingDate: nextDate });

  return nextDate;
}

module.exports = { recalculateNextHearingDate };
