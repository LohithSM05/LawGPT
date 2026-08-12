# PROJECT_MEMORY.md — LawGPT

Single source of truth for architecture decisions, current state, and what's
real vs scaffolded. Read this before starting a new module so you don't have
to re-derive context from scratch.

## Product vision (updated by change request)

LawGPT is an **AI-powered Legal Case Management & Research Platform**, not
just a chatbot. Every case gets its own ChatGPT-like workspace (conversation
+ documents + evidence + judgments + timeline + notes + reports). A left
sidebar organizes three domains: **Case Workspace**, **Legal Research
Center**, **Practice Management**. The UI is multi-language (English +
Kannada now, extensible) via react-i18next.

## Architecture (unchanged since Module 1)

Three services — React/Vite frontend, Node/Express backend, Python/FastAPI
AI service — see `docs/ARCHITECTURE.md` for the full breakdown and data flow.

## Module status

- [x] Module 1 — Architecture & scaffolding
- [x] Module 2 — Authentication (backend complete; frontend complete, retrofitted for the new IA)
- [x] Architecture update — sidebar/topbar shell, i18n, IA restructuring
- [x] **Module 3 — Case Management + Smart Case Folder + Hearing Management**
- [ ] Module 4 — Document upload pipeline (OCR → extraction → chunking → embeddings → vector store) — **next**
- [ ] Module 5 — Case analysis (summary, timeline, entities, IPC/BNS tagging) — also backs the BNS / BNSS / BSA sidebar pages
- [ ] Module 6 — Similar judgments (RAG) — also backs Judge Research, Constitution, Supreme/High Court, Judgment Search, Case Comparison, Legal Dictionary
- [ ] Module 7 — Arguments + evidence scoring — also backs Evidence Analyzer
- [ ] Module 8 — Legal chatbot — also backs AI Assistant (and replaces the sample data in the case-workspace preview)
- [ ] Module 9 — PDF reports — also backs the Reports sidebar page
- [ ] Module 10 — Polish/logging/integration pass — also backs Clients, cross-case Hearings calendar, Tasks, Calendar, Analytics, Settings, Bookmarks

**Renumbering note**: Module 3 was originally "document upload pipeline."
The change request redefined Module 3 as Case Management, so everything
from the old Module 4 onward shifted down one slot. `toolsRegistry.js`
`plannedModule` values were updated to match — if you're adding a new
placeholder tool, check this table first.

## Frontend information architecture (new)

**Public** (`Layout` + `Navbar`, no sidebar): `/`, `/login`, `/register`, `/forgot-password`

**Authenticated** (`AppShell` = `Sidebar` + `TopBar`):
- `/app` → redirects to `/app/cases/ongoing`
- `/app/profile`
- `/app/search` (captures query, not wired to a real index yet)
- `/app/cases/new`, `/app/cases/preview` (design preview, sample data), `/app/cases/:status`
- `/app/case/:caseId/edit` — literal `edit` segment, registered as a sibling
  of `/app/case/:caseId` so React Router's static-over-dynamic ranking picks
  it over the `:section` catch-all below (verified working, not just assumed)
- `/app/case/:caseId` (`CaseDetailLayout`, real data via `GET /cases/:id`) → `overview` / `timeline` / `hearings` / `hearings/:hearingId` / `parties` / `notes` / `activity` (all real) / `:section` (generic `CaseComingSoonTab` for documents/evidence/witnesses/laws/judgments/ai-analysis/strategy/reports)
- `/app/research/:slug`, `/app/practice/:slug` — generic `ComingSoonView`, data-driven

Sidebar nav items live in `frontend/src/config/navigation.js` (case
statuses) and `frontend/src/config/toolsRegistry.js` (research + practice
tools). Adding a sidebar item is a one-line config change, not a new
component or route file.

## Case Management (Module 3) — final implementation

**Core model**: `Case` (`backend/src/models/Case.js`) is the central entity —
not a document. Embedded `parties[]` and `notes[]` subdocuments; a separate
`Hearing` collection (`backend/src/models/Hearing.js`) for the one-to-many
case→hearings relationship. `caseType`, party `role`, and `hearingType` are
free-text strings (curated suggestions via `<datalist>` in
`frontend/src/config/caseOptions.js`), not Mongoose enums — new categories
are a one-line config edit, no migration.

**Three independent boolean/status dimensions on `Case`** — don't conflate them:
- `status`: `ongoing` / `won` / `lost` / `closed` — the 4 real case outcomes.
- `isArchived`: orthogonal flag, user-driven via `PATCH /:id/archive` /
  `/:id/restore`. A case can be archived at any status.
- `isDeleted` (+ `deletedAt`): soft-delete flag, set via `DELETE /:id`,
  cleared via `PATCH /:id/undelete`. **Excluded from `listCases`
  unconditionally**, regardless of `isArchived` — a deleted case disappears
  from the Archived view too, not just its original status view. A case can
  be both `isArchived: true` and `isDeleted: true` at once (deleting an
  archived case doesn't clear the archive flag); every list query still
  hides it either way.

Why `status` is 4 values and not 5 ("archived" isn't one of them): the
product spec asked for "Archived" as a status value *and* a separate
`isArchived` boolean with explicit Archive/Restore actions — two archival
mechanisms fighting each other makes "restore" ambiguous (restore to what
prior status?). Resolved by keeping `status` to real outcomes only. See the
comment block at the top of `Case.js`.

**`Case.nextHearingDate` has exactly one writer.** `recalculateNextHearingDate(caseId)`
(`backend/src/services/hearingSchedulingService.js`) is the *only* code path
that sets this field — `PUT /api/cases/:id` explicitly excludes it from the
fields it will touch, even if sent in the request body (silently ignored,
same as any other non-allowed field). The function queries for the earliest
`Hearing` with `status: 'scheduled'`, `isDeleted: { $ne: true }`, and
`hearingDate >= now`; sets `Case.nextHearingDate` to that date, or `null` if
none exists. **It never invents, predicts, or carries forward a stale
value** — only a hearing date a user explicitly entered, on a hearing that's
still genuinely scheduled and in the future. Called after every hearing
create / update / transition / soft-delete.

**Hearing lifecycle — two deliberately separate write paths:**

1. `PUT /cases/:caseId/hearings/:hearingId` (`updateHearing`) — general
   correction of factual fields: `hearingDate`, `court`, `judge`,
   `hearingType`, `summary`, `notes`, `outcome`, `adjournmentReason`.
   **Cannot change `status` or `nextHearingDate`/`nextHearingNotes`** —
   those aren't in the validator or the controller's allowed-fields list, so
   they're rejected/ignored even if sent. `hearingDate` editing here is for
   genuine data-entry corrections (a typo), not for moving a hearing to a
   new date because it got adjourned — that's a different action (below).
2. `POST /cases/:caseId/hearings/:hearingId/transition` (`transitionHearing`)
   — the *only* path that can change a hearing's `status`, or set its
   `nextHearingDate`/`nextHearingNotes`. Backs the UI's Mark Completed /
   Adjourn / Postpone / Reschedule / Cancel / No Appearance actions.
   `status` must be one of the 6 non-`scheduled` values (`scheduled` is only
   ever a hearing's initial state). **This hearing's own `hearingDate` field
   is never touched here.** If the caller also supplies a `nextHearingDate`
   (only when `status` is `adjourned`/`postponed`/`rescheduled`), a
   **separate new `Hearing` document** is created — new `hearingNumber`
   (atomically claimed, same as at creation), `status: 'scheduled'`,
   `previousHearingId` pointing back to the hearing being transitioned. The
   original hearing's date is untouched; the new hearing is a new row. If no
   date is known yet, none is invented — the hearing just sits at
   `adjourned`/`postponed` with `nextHearingDate: null` on both the hearing
   and (once recalculated) the case.

   Example, matching the product spec exactly:
   ```
   Hearing #3 — 09 Aug 2026 — status: adjourned, reason: "Counsel unavailable"
                                          │ (previousHearingId)
                                          ▼
   Hearing #4 — 30 Aug 2026 — status: scheduled
   ```
   Hearing #3's date never becomes 30 Aug. If the court hadn't given a date
   yet, there would be no Hearing #4, and `Case.nextHearingDate` would be
   `null` until one is actually created.

7 hearing statuses (`backend/src/models/Hearing.js`): `scheduled`,
`completed`, `adjourned`, `postponed`, `cancelled`, `no_appearance`,
`rescheduled`.

**Hearing numbering is race-safe.** `claimNextHearingNumber(caseId)` in
`hearingController.js` atomically does
`Case.findByIdAndUpdate(caseId, { $inc: { hearingCounter: 1 } })` — MongoDB
serializes `$inc`, so two concurrent "add hearing" requests can never
compute the same number (unlike counting existing documents and adding 1,
which races). `Case.hearingCounter` is an internal field (`select: false`).
The unique `{ caseId: 1, hearingNumber: 1 }` index on `Hearing` is a safety
net on top of the atomic counter, not the primary defense — `createHearing`
and `transitionHearing`'s follow-up-hearing creation both go through
`createHearingSafely()`, which turns a stray E11000 into a clean 409 instead
of a raw Mongo error. Numbers are never reassigned on delete.

**Soft-delete exists for both `Case` and `Hearing`, with one intentional
asymmetry.** Both have `isDeleted`/`deletedAt`. Both are excluded from their
respective list endpoints (`listCases`, `listHearings`) unconditionally. Both
remain directly fetchable by ID (`getCase`/`getHearing` apply no `isDeleted`
filter) — this is what lets `previousHearingId` links and Timeline entries
keep working, and what lets `CaseDetailLayout` show a "this case was
deleted, restore it" banner if you land on one. Case has a real undelete
endpoint (`PATCH /cases/:id/undelete`) and that banner; **Hearing does not**
— there's no `PATCH /hearings/:id/undelete` and no restore UI, so a deleted
hearing is currently only viewable, not recoverable through the app itself
(the document still exists in MongoDB, so it's not unrecoverable, just not
exposed). `updateHearing`/`transitionHearing` both exclude `isDeleted`
hearings from their lookup (viewable via `getHearing`, not editable).
Neither soft-delete cascades: deleting a Case does not touch its Hearings;
deleting a Hearing does not touch the Case or other Hearings.
`recalculateNextHearingDate` excludes `isDeleted` hearings, so a deleted
still-"scheduled" hearing correctly stops counting toward
`Case.nextHearingDate`.

**`CaseEvent`** (`backend/src/models/CaseEvent.js`) is an append-only log —
25 event types spanning case/party/note/hearing lifecycle,
`{ createdAt: true, updatedAt: false }` (events are never edited, only
created). `GET /cases/:id/timeline` reads this collection directly
(`CaseEvent.find({ caseId }).sort('createdAt')`) rather than deriving events
from Case/Hearing timestamps on the fly. Timeline (`CaseTimelineTab`) and
Activity (`CaseActivityTab`) both consume this same endpoint — Timeline
renders it as a graphical vertical list, Activity as a flat
reverse-chronological feed. **Not a field-level audit log**: each event has
a human-readable `title`/`description` and a free-form `metadata` object
(e.g. `{ from, to }` on `CASE_STATUS_CHANGED`), not a structured
before/after diff for every field on every edit.

**Notes** are embedded subdocuments on `Case` with full CRUD, including
`PUT /cases/:id/notes/:noteId` (edit) — added after the initial build, which
only had add/delete.

**Access control**: non-admin users only ever see cases they created or are
in `assignedUsers` for (`middleware/caseAccess.js` + the `scopeToUser`
filter in `listCases`). Admins see everything. Hearings inherit their parent
case's access check — every hearing route runs `loadCase` +
`requireCaseAccess` via the nested router
(`router.use('/cases/:caseId/hearings', hearingRoutes)` in `routes/index.js`).

**Perspective-aware architecture**: deliberately *not* implemented. Case
facts, evidence, and hearings stay neutral — no per-party duplication —
specifically so a later module can layer a selectable perspective
(defence/prosecution/petitioner/etc.) over the same neutral data without
restructuring it.

**Smart Case Folder tabs**: `overview`, `timeline`, `hearings` (+ hearing
detail), `parties`, `notes`, `activity` are real, backed by the API.
`documents`, `evidence`, `witnesses`, `laws`, `judgments`, `ai-analysis`,
`strategy`, `reports` render through one generic `CaseComingSoonTab`
(`frontend/src/pages/app/case/CaseComingSoonTab.jsx`), each tagged with the
module that will build it (see `COMING_SOON_TABS` in `CaseDetailLayout.jsx`)
— nothing fabricated behind any of them.

**Frontend hearing forms**: `HearingForm.jsx` (create + factual-correction
edit) hides its `status` field entirely when editing an existing hearing —
status there is shown read-only with a pointer to the action buttons; status
is still offered at creation time, since a brand-new hearing legitimately
needs *some* initial status (defaults to `scheduled`) and there's no history
to bypass yet. Next-hearing-date fields were removed from `HearingForm`
entirely and live exclusively in `HearingTransitionForm.jsx`, which backs
the 6 action buttons (Mark Completed / Adjourn / Postpone / Reschedule /
Cancel / No Appearance) plus a separate "Add Next Hearing" button on
`HearingDetail.jsx` (a plain `createHearing` call with `previousHearingId`
set, for adding a hearing without going through a transition).

**"+ Add Note" is real; "+ Add Document"/"+ Add Evidence" stayed disabled
placeholders** on the Case Overview page — Notes needed no unbuilt
subsystem (plain embedded subdocument); Documents/Evidence need the Module 4
upload pipeline first. The spec explicitly allows this split.

See `docs/MODULE3_CASES.md` for the full API reference and testing checklist.

## What's real vs scaffolded right now

**Real, end to end:** register/login/logout/refresh/profile-edit, dark mode,
language switching (en/kn, persisted), sidebar/topbar navigation shell,
responsive collapse + mobile drawer, **full case CRUD (create/view/edit/
soft-delete+undelete/archive/restore/status-change/pin), parties, editable
notes, hearings (create/edit/soft-delete + atomic numbering + full 7-status
lifecycle via the guided transition action + Case.nextHearingDate kept
correct by recalculateNextHearingDate), case search/filter, event-log-backed
timeline and activity feed.**

**Scaffolded, clearly labeled in-UI (not faked as working):**
- Case-workspace chat/rich-cards — still only the `/app/cases/preview` sample screen; real cases use the (currently real, non-AI) Smart Case Folder tabs instead
- Documents, Evidence, Witnesses, Applicable Laws, Judgments, AI Analysis, Courtroom Strategy, Reports — per-case tabs, generic `CaseComingSoonTab`
- All 13 Legal Research Center tools and 6 of 7 Practice Management tools (Hearings has per-case functionality now; the rest are still placeholders) — generic `ComingSoonView`
- Global search — captures and displays the query, doesn't hit a real index
- Case/hearing Activity — real events from `CaseEvent`, not a full field-level audit log (see Module 3 section above)

## Key decisions log

- **Auth**: access token in memory only (never localStorage), httpOnly
  refresh cookie, rotation + reuse detection on every `/auth/refresh`. See
  `docs/MODULE2_AUTH.md`.
- **i18n**: react-i18next with locale JSON bundled at build time (no runtime
  fetch backend), namespaced `common` / `nav` / `auth`. Language persisted to
  `localStorage`, auto-detected from the browser on first visit. Adding a
  language = new `locales/<code>/*.json` folder + one entry in
  `i18n/config.js` — no component changes, since every component reads
  labels through `t()` keys.
- **Kannada translations** were written directly for nav labels, common
  actions, and the auth forms — not machine-translated after the fact.
  Legal-domain terms (BNS/BNSS/BSA, court names) should get a native-speaker
  / legal review pass before this is used in a real submission — flagged,
  not silently assumed correct.
- **Layout split**: the sidebar/topbar chrome only wraps authenticated
  `/app/*` routes; Landing/Login/Register keep the simpler public `Navbar` —
  a logged-out visitor shouldn't see 25 nav items.
- **AI backend language parameter**: not implemented yet (python-ai has no
  endpoints until Module 3), but every Pydantic request schema from Module 3
  onward should accept a `language: Literal['en', 'kn']` field threaded
  through from the frontend's current i18n language, so responses can
  eventually come back in the user's chosen language. Noted here so it isn't
  forgotten when Module 3/4 schemas get designed.

## i18n coverage — what's done vs outstanding

Fully translated: Sidebar, TopBar (search/language/notifications/profile
menus), Navbar, LoginForm, RegisterForm, Login, Register pages.

**Not yet retrofitted** (still English-only, tracked as follow-up, not
silently skipped): `Profile.jsx` labels/form, and some `Landing.jsx` body
copy (capability card descriptions).

## Environment variables added this session

None — this was a UI/architecture update, no new backend env vars.

## Open follow-ups

1. Full i18n coverage of `Profile.jsx` and remaining `Landing.jsx` copy — the Module 3 case-management pages are also English-only for now, same reasoning (kept moving on functional scope first, tracked here rather than silently skipped).
2. Document model + upload pipeline (Module 4) — will populate the Documents/Evidence/Witnesses case-folder tabs and the Overview page's document/evidence counts (currently real zeros).
3. Kannada legal-terminology review before real submission/demo use.
4. `language` parameter in python-ai's Pydantic schemas (see decisions log above).
5. Full field-level audit log (who changed which field, old → new value) for the case Activity tab — `CaseEvent` logs *that* something changed and a human-readable title, but not a structured before/after diff for every field.
6. Cross-case Hearings calendar (Practice Management sidebar) — per-case hearings are real; this aggregation view is not.
7. Multi-user case assignment UI — `Case.assignedUsers` exists at the data layer and defaults to `[createdBy]`, but there's no picker to assign a case to a colleague yet (would need a "list org users" endpoint that doesn't exist).
8. **No dedicated Trash UI.** Case soft-delete has a restore *banner* (if you land on a deleted case's own URL) but no browsable list of your deleted cases. Hearing soft-delete has neither a restore endpoint nor any UI — a deleted hearing's document still exists in MongoDB (not unrecoverable), but nothing in the app can undelete it yet. Both are intentionally out of scope for now, not oversights.
9. `hearingCounter` on `Case` is internal bookkeeping (`select: false`) — if a future migration or bulk-import script inserts hearings directly (bypassing `createHearing`), it must also bump this counter, or the next real `createHearing`/`transitionHearing` call could collide with the unique index.
