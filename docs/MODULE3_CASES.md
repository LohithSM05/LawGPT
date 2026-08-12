# Module 3 — Case Management + Smart Case Folder + Hearing Management

This document describes the code that actually exists in the current
codebase — not planned functionality. Where something is a placeholder, it
is explicitly labeled as such below and in the running app itself. No new
environment variables were added by this module.

---

## 1. Case architecture

`Case` (`backend/src/models/Case.js`) is the central entity of the
application — not a document. Fields:

| Field | Type | Notes |
|---|---|---|
| `caseNumber` | String, required | Unique per `createdBy`, not globally |
| `title` | String, required, max 200 | |
| `description` | String | |
| `caseType` | String, required | Free text — curated list suggested by the frontend, not a DB enum |
| `court`, `state`, `jurisdiction` | String | User-entered, never fabricated |
| `status` | enum: `ongoing`, `won`, `lost`, `closed` | Default `ongoing` |
| `priority` | enum: `low`, `medium`, `high`, `urgent` | Default `medium` |
| `filingDate` | Date | |
| `nextHearingDate` | Date | **Read-only from the API's perspective — see §6** |
| `createdBy`, `assignedUsers` | User refs | `assignedUsers` defaults to `[createdBy]`; no UI to add others yet |
| `parties` | embedded array | See §3 |
| `notes` | embedded array | See §9 |
| `tags` | String array | |
| `isPinned` | Boolean | |
| `isArchived` | Boolean | Orthogonal to `status` — see below |
| `isDeleted`, `deletedAt` | Boolean, Date | Soft-delete — see §10 |
| `hearingCounter` | Number, internal (`select: false`) | Atomic hearing-numbering source — see §5 |

**Why `status` has 4 values, not 5**: an earlier draft of the spec listed
"Archived" as a status value *and* asked for a separate `isArchived`
boolean with explicit Archive/Restore actions. Two archival mechanisms
conflict — restore to which prior status? Resolved by keeping `status` to
real case outcomes only, with `isArchived` as an independent flag. A case
can be archived at any status.

**Three independent flags, not one**: `status`, `isArchived`, and
`isDeleted` are all separate and can combine — e.g. a case can be
`status: 'won'`, `isArchived: true`, `isDeleted: true` all at once (you
deleted a case you'd previously archived). Every list query excludes
`isDeleted: true` unconditionally, regardless of the other two flags.

No case data (case type, court, dates, etc.) is ever auto-generated or
guessed — the backend only stores what the user submits.

## 2. Smart Case Folder

`CaseDetailLayout.jsx` fetches one case (`GET /cases/:id`) and renders a tab
bar plus the routed child page. Real tabs, backed by the API:

`overview` · `timeline` · `hearings` (+ `hearings/:hearingId` detail) ·
`parties` · `notes` · `activity`

Placeholder tabs, rendered by one generic `CaseComingSoonTab` component
(no fake data, each clearly labeled with the module that will build it):

`documents` (Module 4) · `evidence` (Module 4) · `witnesses` (Module 4) ·
`laws` (Module 5) · `judgments` (Module 6) · `ai-analysis` (Module 5) ·
`strategy` (Module 8) · `reports` (Module 9)

The Case Overview page shows real stats (hearing count, party count, last
activity) and real document/evidence counts of **zero** (not a placeholder
— there is no Document/Evidence model yet, so zero is accurate). Its
"+ Add Hearing" and "+ Add Note" buttons are fully functional; "+ Add
Document" and "+ Add Evidence" are visibly disabled with a tooltip pointing
to Module 4, per the spec's explicit allowance for this split.

## 3. Party architecture

Parties are **embedded subdocuments on `Case`**, not a separate collection
— `case.parties: [{ name, role, entityType, contact, notes, createdAt,
updatedAt, _id }]`. `role` is free text (curated suggestions: Plaintiff,
Defendant, Petitioner, Respondent, Complainant, Accused, Applicant,
Appellant, Opposing Party, Other — plus anything else the user types).
`entityType` is `person` or `organization`.

**Neutrality**: party data is purely descriptive (who is involved, in what
role) — it carries no perspective-dependent analysis, no "our side vs their
side" framing, and no duplication of case facts per party. This is
deliberate: a later module can layer a selectable perspective
(defence/prosecution/petitioner/etc.) over the same neutral case data
without restructuring it. No AI analysis of any kind runs on party data in
this module.

Full CRUD: `POST/PUT/DELETE /cases/:id/parties[/:partyId]`.

## 4. Hearing architecture

`Hearing` (`backend/src/models/Hearing.js`) is a **separate collection**,
many-per-case via `caseId`:

| Field | Type | Notes |
|---|---|---|
| `caseId` | Case ref, required, indexed | |
| `hearingNumber` | Number, required | Atomically assigned — see §5 |
| `hearingDate` | Date, required | **Never overwritten by a lifecycle transition — see §6** |
| `court`, `judge` | String | |
| `hearingType` | String, required | Free text, curated suggestions |
| `status` | enum, 7 values | See §6 |
| `summary`, `notes`, `outcome` | String | |
| `adjournmentReason` | String | Set when transitioning to adjourned/postponed/rescheduled |
| `nextHearingDate`, `nextHearingNotes` | Date, String | Informational annotation on *this* hearing about what was decided — see §6 |
| `previousHearingId` | Hearing ref | Links a follow-up hearing back to the one it continues from |
| `isDeleted`, `deletedAt` | Boolean, Date | Soft-delete — see §10 |
| `createdBy` | User ref | |

## 5. Hearing numbering

Race-safe by construction, not by luck. `claimNextHearingNumber(caseId)`
(in `hearingController.js`) does:

```js
Case.findByIdAndUpdate(caseId, { $inc: { hearingCounter: 1 } }, { new: true })
```

MongoDB serializes `$inc` operations — two concurrent "add hearing"
requests can never read/compute the same number, unlike the earlier
"count existing hearings, add 1" approach this replaced. `Case.hearingCounter`
is internal bookkeeping (`select: false`), not exposed via the API.

**Unique compound index** on `Hearing`:
```js
hearingSchema.index({ caseId: 1, hearingNumber: 1 }, { unique: true })
```
This is a **safety net**, not the primary defense — the atomic counter is
what actually prevents the race. The index exists in case of a bug, a
manual DB edit, or a future migration mistake. `createHearingSafely()`
wraps every `Hearing.create()` call so a stray E11000 duplicate-key error
comes back as a clean `409 Conflict` instead of a raw Mongo exception.

Hearing numbers are **never renumbered** — deleting hearing #2 leaves #1
and #3 exactly as they are.

## 6. Hearing lifecycle

Two deliberately separate write paths — this is the core correction from
the original build:

**`PUT /cases/:caseId/hearings/:hearingId`** (general edit, for correcting
a genuine data-entry mistake): can change `hearingDate`, `court`, `judge`,
`hearingType`, `summary`, `notes`, `outcome`, `adjournmentReason`. **Cannot
change `status` or `nextHearingDate`/`nextHearingNotes`** — those fields
are absent from both the validator and the controller's allowed-fields
list, so they're rejected/ignored even if included in the request body.

**`POST /cases/:caseId/hearings/:hearingId/transition`** (the guided
lifecycle action — the only path that can change `status` or set
`nextHearingDate`): backs the UI's Mark Completed / Adjourn / Postpone /
Reschedule / Cancel / No Appearance actions. Body: `{ status,
adjournmentReason?, outcome?, notes?, nextHearingDate?, nextHearingNotes? }`.
`status` must be one of the 6 non-`scheduled` values — `scheduled` is only
ever a hearing's initial state, never a transition target.

**The historical date is never overwritten.** This hearing's own
`hearingDate` field is not touched by the transition endpoint under any
circumstances. If the caller supplies `nextHearingDate` (only meaningful
when `status` is `adjourned`, `postponed`, or `rescheduled`), a **separate
new `Hearing` document** is created instead — new `hearingNumber` (claimed
the same atomic way), `status: 'scheduled'`, `previousHearingId` pointing
back to the hearing being transitioned.

**Worked example** (matches the product spec):

```
Hearing #3
09 Aug 2026
ADJOURNED
Reason: Counsel unavailable
        │
        │  previousHearingId
        ▼
Hearing #4
30 Aug 2026
SCHEDULED
```

After this: `GET /cases/:id/hearings/<hearing3Id>` still returns
`hearingDate: "2026-08-09"`, `status: "adjourned"` — untouched. A new
`Hearing` document exists with `hearingDate: "2026-08-30"`,
`status: "scheduled"`, `previousHearingId: <hearing3Id>`.

**If the court has not given a new date yet**: the caller omits
`nextHearingDate` entirely. The hearing is transitioned to
`adjourned`/`postponed` with no new hearing created, and (per §7)
`Case.nextHearingDate` becomes `null` unless another scheduled hearing
already covers it. LawGPT never invents, guesses, or defaults a date.

Hearing statuses (`Hearing.HEARING_STATUSES`): `scheduled`, `completed`,
`adjourned`, `postponed`, `cancelled`, `no_appearance`, `rescheduled`.

## 7. Next-hearing-date calculation

`recalculateNextHearingDate(caseId)` (`backend/src/services/hearingSchedulingService.js`)
is the **only** code path in the entire codebase that writes
`Case.nextHearingDate`. `PUT /cases/:id` explicitly excludes this field
from what it will apply, even if present in the request body.

```js
Hearing.findOne({
  caseId,
  status: 'scheduled',
  isDeleted: { $ne: true },
  hearingDate: { $gte: new Date() },
}).sort('hearingDate')
```

Sets `Case.nextHearingDate` to that hearing's date, or `null` if no such
hearing exists. Called after every hearing create, update, transition, and
soft-delete — so the field can never carry a stale value. It is a pure
derivation from real `Hearing` records; nothing in the codebase predicts or
invents a hearing date.

## 8. CaseEvent / Timeline / Activity

`CaseEvent` (`backend/src/models/CaseEvent.js`) is an **append-only
event log** — `{ caseId, hearingId?, eventType, title, description,
createdBy, metadata, createdAt }`, no `updatedAt` (events are never
edited, only created). 25 event types across the case/party/note/hearing
lifecycle (`CASE_CREATED`, `CASE_STATUS_CHANGED`, `HEARING_ADJOURNED`,
`NEXT_HEARING_SCHEDULED`, etc. — full list in `CaseEvent.js`).

`GET /cases/:id/timeline` returns `CaseEvent.find({ caseId }).sort('createdAt')`
directly — not derived from Case/Hearing timestamps on the fly. `CaseTimelineTab`
renders this as a graphical vertical timeline; `CaseActivityTab` renders the
same data reversed, as a flat list. Both are real; neither invents an event
that didn't happen, and an adjourn-with-new-date produces **two** entries
(the adjournment on the old hearing, `NEXT_HEARING_SCHEDULED` on the new
one) rather than one overwriting the other.

**Not a field-level audit log**: each event carries a human-readable title
and optional free-form `metadata` (e.g. `{ from: 'ongoing', to: 'won' }`
on `CASE_STATUS_CHANGED`), not a structured before/after diff for every
field on every edit. See §12.

## 9. Notes

Embedded subdocuments on `Case` — `case.notes: [{ content, author,
createdAt, updatedAt, _id }]`. Full CRUD:
`POST /cases/:id/notes`, `PUT /cases/:id/notes/:noteId`,
`DELETE /cases/:id/notes/:noteId`. Each action logs a `NOTE_ADDED` /
`NOTE_UPDATED` / `NOTE_DELETED` `CaseEvent`.

## 10. Soft-delete

Both `Case` and `Hearing` have `isDeleted`/`deletedAt`, with one
intentional asymmetry:

| | Case | Hearing |
|---|---|---|
| Set by | `DELETE /cases/:id` | `DELETE /cases/:caseId/hearings/:hearingId` |
| Excluded from list | `listCases` (unconditionally) | `listHearings` |
| Fetchable by ID | Yes (`getCase` applies no `isDeleted` filter) | Yes (`getHearing` applies no `isDeleted` filter) |
| Editable while deleted | N/A (no direct field-edit endpoint) | No — `updateHearing`/`transitionHearing` exclude `isDeleted` hearings |
| Restore endpoint | `PATCH /cases/:id/undelete` | **None** |
| Restore UI | Banner on `CaseDetailLayout` if you land on a deleted case | **None** |

Neither cascades: deleting a case does not touch its hearings; deleting a
hearing does not touch the case or its other hearings. `recalculateNextHearingDate`
excludes `isDeleted` hearings, so a deleted still-"scheduled" hearing
correctly stops counting toward `Case.nextHearingDate`.

A soft-deleted hearing's document still exists in MongoDB — it is not
unrecoverable data, it's just not exposed for restoration through the app
yet. No dedicated "Trash" list UI exists for either cases or hearings; see
§12.

## 11. Authorization

Unchanged since the original Module 3 build. `middleware/caseAccess.js`:
`loadCase` fetches a case by `:id`/`:caseId` (regardless of `isDeleted` —
see §10) and 404s if it doesn't exist; `requireCaseAccess` allows the
case's `createdBy`, anyone in `assignedUsers`, or an `admin`-role user —
403 otherwise. Every hearing route runs both middlewares via the nested
router mount (`router.use('/cases/:caseId/hearings', hearingRoutes)`), so
hearing access always inherits the parent case's access rule.
Non-admin `listCases`/`listHearings` results are additionally scoped to
cases the user created or is assigned to.

## 12. Known limitations (intentional, not bugs)

- **No dedicated Trash UI.** Case soft-delete has a restore *banner* (only
  reachable if you know/land on the deleted case's own URL) but no
  browsable list of your deleted cases. Hearing soft-delete has neither a
  restore endpoint nor any UI at all.
- **`CaseEvent` does not provide field-level before/after diffs.** It logs
  *that* something happened, with a human-readable description — not a
  structured record of every field's old value and new value.
- **`hearingCounter`** is internal, atomic bookkeeping on `Case`. Any future
  bulk-import or migration script that inserts `Hearing` documents directly
  (bypassing `createHearing`/`transitionHearing`) must also advance this
  counter, or the next real hearing-creation call risks colliding with the
  unique index.
- Perspective-aware AI strategy engine, multi-user case-assignment UI, and
  a cross-case hearing calendar are out of scope for this module (see
  `PROJECT_MEMORY.md`).

## 13. API endpoints

Base URL: `http://localhost:5000/api`. All routes require
`Authorization: Bearer <accessToken>`.

**Cases**
```
POST   /cases
GET    /cases                          ?status&isPinned&isArchived&caseType&court&priority&tags&search&sort&page&limit
GET    /cases/:id                      → { case, stats: { hearingCount, documentCount, evidenceCount, lastActivity } }
PUT    /cases/:id                      (nextHearingDate NOT accepted)
DELETE /cases/:id                      soft-delete
PATCH  /cases/:id/undelete
PATCH  /cases/:id/status               { status }
PATCH  /cases/:id/archive
PATCH  /cases/:id/restore
PATCH  /cases/:id/pin                  { isPinned }
GET    /cases/:id/timeline             → { events } from CaseEvent
```

**Parties**
```
POST   /cases/:id/parties
PUT    /cases/:id/parties/:partyId
DELETE /cases/:id/parties/:partyId
```

**Notes**
```
POST   /cases/:id/notes                { content }
PUT    /cases/:id/notes/:noteId        { content }
DELETE /cases/:id/notes/:noteId
```

**Hearings** (nested under a case)
```
POST   /cases/:caseId/hearings                          hearingNumber assigned server-side
GET    /cases/:caseId/hearings                           excludes soft-deleted
GET    /cases/:caseId/hearings/:hearingId                 does NOT exclude soft-deleted
PUT    /cases/:caseId/hearings/:hearingId                  status/nextHearingDate NOT accepted
POST   /cases/:caseId/hearings/:hearingId/transition        status/nextHearingDate ONLY changeable here
DELETE /cases/:caseId/hearings/:hearingId                  soft-delete
```

Example transition call:
```bash
curl -X POST http://localhost:5000/api/cases/<caseId>/hearings/<hearingId>/transition \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "status": "adjourned",
    "adjournmentReason": "Counsel unavailable",
    "nextHearingDate": "2026-08-30",
    "nextHearingNotes": "Confirmed by registrar"
  }'
# → { hearing: {...status: "adjourned", hearingDate unchanged...},
#     newHearing: {...hearingNumber+1, hearingDate: "2026-08-30", status: "scheduled"...} }
```
Omit `nextHearingDate` if the court hasn't given one — `newHearing` will be
`null` in the response, and `Case.nextHearingDate` will be `null` unless
another scheduled hearing already covers it.

## 14. Frontend routes/components

```
/app/cases/new                          NewCase.jsx (CaseForm, create mode)
/app/cases/preview                      CaseWorkspacePreview.jsx — sample-data design preview, unrelated to real cases
/app/cases/:status                      CaseListView.jsx — real data, wired to sidebar filters
/app/case/:caseId/edit                  EditCase.jsx (CaseForm, edit mode)
/app/case/:caseId                       CaseDetailLayout.jsx — fetches the case once, tab nav, Archive/Delete/Status-change menu
  ├─ overview                           CaseOverviewTab.jsx
  ├─ timeline                           CaseTimelineTab.jsx
  ├─ hearings                           CaseHearingsTab.jsx (list + inline "add hearing" form)
  ├─ hearings/:hearingId                HearingDetail.jsx — lifecycle action bar, edit, delete
  ├─ parties                            CasePartiesTab.jsx (inline add/edit/delete)
  ├─ notes                              CaseNotesTab.jsx (inline add/edit/delete)
  ├─ activity                           CaseActivityTab.jsx
  └─ :section                           CaseComingSoonTab.jsx (documents/evidence/witnesses/laws/judgments/ai-analysis/strategy/reports)
```

Key components: `components/cases/CaseForm.jsx` (create+edit),
`HearingForm.jsx` (create + factual-correction edit — hides `status` when
editing, no next-hearing-date fields at all),
`HearingTransitionForm.jsx` (the 6 lifecycle actions — reason, notes,
optional next-hearing-date). Services: `services/caseService.js`,
`services/hearingService.js` (includes `transitionHearing`).

## 15. Testing checklist

**Cases**: create · update (confirm `nextHearingDate` in the request body
is silently ignored) · archive · restore · soft-delete · undelete · status
change · unauthorized user blocked (403) · invalid case ID (404).

**Hearing numbering**: create hearings #1, #2, #3 in sequence → correct
numbers · fire two "add hearing" requests concurrently → different numbers,
no duplicate-key error surfaces to the client · delete hearing #2 → #3
keeps its number.

**Hearing lifecycle**: `PUT` a hearing with `status`/`nextHearingDate` in
the body → both silently ignored, hearing unchanged · transition to
`adjourned` with a reason but no date → status changes, `hearingDate`
unchanged, no new hearing · transition to `adjourned` **with** a date →
original `hearingDate` unchanged, new hearing created with the new date and
`status: scheduled`, `previousHearingId` set correctly · complete a hearing
with an outcome · cancel · mark no-appearance · after each action, verify
`Case.nextHearingDate` reflects the earliest remaining scheduled future
hearing, or is `null` if none exists.

**Hearing soft-delete**: delete a hearing → gone from `listHearings`, still
fetchable via `getHearing`, still referenced correctly by any
`previousHearingId` pointing to it, `Case.nextHearingDate` recalculated
correctly if it was the case's next hearing.

**Notes**: create, update, delete — each produces the matching `CaseEvent`.

**Timeline/Events**: every case and hearing action produces the correct
event type, in chronological order, with an adjourn-with-new-date producing
two separate entries.

**Authorization**: owner, assigned-user, and admin access all work;
unrelated user blocked; invalid case/hearing ID 404s.

## 16. Explicitly NOT implemented in this module

The following are future-module functionality and are **not present** in
this codebase in any form — no stubs, no partial logic, no fake responses:

OCR · Document processing · Evidence analysis · RAG · Embeddings · Indian
legal knowledge base · Judgment retrieval · AI case analysis ·
Perspective-aware analysis · Opposition Simulator · Red Team Analysis ·
Courtroom Strategy · Argument generation.

Every place the UI references these (Smart Case Folder placeholder tabs,
Legal Research Center / Practice Management sidebar items) renders through
`CaseComingSoonTab` / `ComingSoonView`, which display only a label, an icon,
and which future module will build it — never sample data implying the
feature works.
