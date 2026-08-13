/**
 * These lists back the Select dropdowns for case type, party role, and
 * hearing type. The backend stores all three as free text (see
 * backend/src/models/Case.js and Hearing.js) specifically so this list can
 * be extended here — one array edit — without a schema migration. Every
 * dropdown that uses these also offers a "custom…" option for anything not
 * listed.
 */
export const CASE_TYPES = [
  'Criminal',
  'Civil',
  'Constitutional',
  'Family',
  'Property',
  'Corporate',
  'Consumer',
  'Cyber Crime',
  'Labour',
  'Other',
];

export const PARTY_ROLES = [
  'Plaintiff',
  'Defendant',
  'Petitioner',
  'Respondent',
  'Complainant',
  'Accused',
  'Applicant',
  'Appellant',
  'Opposing Party',
  'Other',
];

export const HEARING_TYPES = [
  'Initial Hearing',
  'Bail Hearing',
  'Evidence Hearing',
  'Argument Hearing',
  'Cross Examination',
  'Final Hearing',
  'Judgment',
  'Appeal',
  'Other',
];

// Curated suggestions for the Documents tab's per-file docType picker. Like
// caseType/party role/hearingType, the backend stores docType as free text —
// this list is just a datalist of suggestions, so extending it is a one-line
// change and anything not listed can still be typed.
export const DOC_TYPES = [
  'FIR',
  'Complaint',
  'Statement',
  'Chargesheet',
  'Court Document',
  'Judgment',
  'Bail Application',
  'Evidence',
  'Petition',
  'Affidavit',
  'Other',
];

// These two ARE fixed enums on the backend (see Case.js / Hearing.js) since
// they drive filtering, badges, and sidebar counts — not free text.
export const CASE_STATUSES = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'closed', label: 'Closed' },
];

export const CASE_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

// Full lifecycle per the Module 3 correction — matches
// backend/src/models/Hearing.js HEARING_STATUSES exactly.
export const HEARING_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'adjourned', label: 'Adjourned' },
  { value: 'postponed', label: 'Postponed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_appearance', label: 'No Appearance' },
  { value: 'rescheduled', label: 'Rescheduled' },
];

// The guided lifecycle actions shown as buttons on the hearing detail page.
// 'scheduled' is deliberately excluded — it's only ever a hearing's initial
// state, never something you transition into.
export const HEARING_ACTIONS = [
  { status: 'completed', label: 'Mark Completed', needsReason: false, allowsNextDate: false },
  { status: 'adjourned', label: 'Adjourn', needsReason: true, allowsNextDate: true },
  { status: 'postponed', label: 'Postpone', needsReason: true, allowsNextDate: true },
  { status: 'rescheduled', label: 'Reschedule', needsReason: true, allowsNextDate: true },
  { status: 'no_appearance', label: 'No Appearance', needsReason: false, allowsNextDate: true },
  { status: 'cancelled', label: 'Cancel', needsReason: true, allowsNextDate: false },
];

export const HEARING_STATUS_BADGE_VARIANT = {
  scheduled: 'secondary',
  completed: 'default',
  adjourned: 'accent',
  postponed: 'accent',
  cancelled: 'outline',
  no_appearance: 'outline',
  rescheduled: 'accent',
};

export const PRIORITY_BADGE_VARIANT = {
  low: 'secondary',
  medium: 'secondary',
  high: 'accent',
  urgent: 'default',
};

export const STATUS_BADGE_VARIANT = {
  ongoing: 'secondary',
  won: 'default',
  lost: 'outline',
  closed: 'outline',
};
