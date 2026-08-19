# LawGPT — Project Status & Roadmap Report

**As of:** August 2026 · **Scope:** everything through Module 5 (AI case analysis)
**Source of truth:** `PROJECT_MEMORY.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/MODULE{2,3,4,5}_*.md`

---

## 1. What we have completed so far

- **Module 1 — Architecture & scaffolding** ✅
- **Module 2 — Authentication** ✅
- **Architecture update — sidebar/topbar shell, i18n, IA restructuring** ✅
- **Module 3 — Case Management + Smart Case Folder + Hearing Management** ✅
- **Module 4 — Document upload & processing pipeline (Phases 1 + 2)** ✅
- **Module 5 Phase 3 — AI legal-document case analysis** ✅ (BNS/BNSS/BSA research sidebar pages still pending)
- **Case Workspace navigation/status UX update** ✅ (won/lost/transferred/other closed-category routing, archived)

Every completed module is a working vertical slice (backend + AI service + frontend page), not a horizontal layer — so after each module the project is demoable.

---

## 2. Current architecture and technology stack

Three independently runnable services, split by technology fit and security boundary:

| Service | Stack | Port | Responsibility |
|---|---|---|---|
| `frontend` | React 18 + Vite + Tailwind + shadcn/ui + react-i18next + Zod | 5173 | UI — auth, dashboard, case workspace, upload, analysis, chat/reports (future) |
| `backend` | Node.js/Express + MongoDB (Mongoose) + JWT | 5000 | Auth, users, cases, hearings, documents, analysis records; API gateway to the AI service |
| `python-ai` | FastAPI + LangChain + ChromaDB + sentence-transformers + Tesseract + Gemini | 8000 | OCR, extraction, chunking, embeddings, RAG, LLM analysis |

```
Browser ── REST + JWT (Bearer) ──► frontend ──► backend ──► MongoDB
                                                │  internal REST (service key)
                                                ▼
                                         python-ai ──► ChromaDB + Gemini API
```

**Why the split:** Node/Express for auth/CRUD/validation; Python for the mature
OCR/NLP/RAG ecosystem. Gemini key + vector store live only inside `python-ai`;
the public backend never touches them — a clean security boundary.

---

## 3. Frontend, backend, Python AI service, database, APIs

### Frontend (`frontend/`)
- **Auth/public pages:** Landing, Login, Register, ForgotPassword, NotFound.
- **App shell (`/app`):** `AppShell` = `Sidebar` + `TopBar`; responsive collapse + mobile drawer; dark mode; en/kn language switching (react-i18next, persisted).
- **Case Workspace:** case lists by status (`ongoing/won/lost/transferred/closed/archived/recent/pinned`), New/Edit case, and the per-case Smart Case Folder tabs — overview, timeline, hearings (+ hearing detail + 6-action transition flow), parties, notes, activity, documents, ai-analysis, laws; remaining tabs render a clearly-labeled "coming soon".
- **Research/Practice sidebar:** 13 research tools + 7 practice tools, data-driven via `config/toolsRegistry.js` → generic `ComingSoonView` until their module lands.
- **Services layer:** one axios module per resource (`auth`, `case`, `hearing`, `document`, `analysis`, `user`).
- **Stack deps:** react-hook-form + zod validation, chart.js, lucide icons, Radix UI primitives.

### Backend (`backend/`)
- **Models:** `User`, `Case` (embedded parties/notes, `hearingCounter`), `Hearing`, `CaseEvent` (append-only log, 27 types), `Document`, `DocumentPage`, `CaseAnalysis`.
- **Routes** (all under `/api`): `/auth`, `/users`, `/cases`, nested `/cases/:caseId/hearings`, `/cases/:caseId/documents`, `/cases/:caseId/analysis`.
- **Middleware:** `protect` (JWT access + httpOnly refresh cookie with rotation/reuse detection), `roleMiddleware`, `caseAccess` (creator/assignedUsers/admin), rate limiter, mongo-sanitize, helmet, centralized `errorMiddleware` (incl. MulterError → clean 400s).
- **Services:** `tokenService`, `caseEventService`, `hearingSchedulingService` (sole writer of `nextHearingDate`), `documentPipelineService` (background worker), `analysisService` (payload builder for python-ai).
- **Validators:** express-validator schemas per resource.

### python-ai (`python-ai/`)
- **Endpoints:** `POST /documents/process`, `POST /documents/search`, `POST /analysis/case`, `GET /health`.
- **Pipeline services:** format detection → extraction (PyMuPDF text layer with per-page OCR fallback via Tesseract; DOCX/TXT/image) → cleaning → **page-aware chunking** (chunks never cross a page boundary) → embeddings (`BAAI/bge-small-en-v1.5`) → ChromaDB upsert.
- **Analysis layer:** `analysis_service` (Kannada detection → optional English-only Chroma grounding → LLM → normalization), `llm_service` (Gemini JSON extraction, `LLM_PROVIDER=gemini|stub`), `rag_service` (retrieval for Modules 5/6), `nlp/ipc_bns_map.py` (curated IPC↔BNS equivalents).
- **Stateless by design:** never touches MongoDB or the uploads filesystem; returns structured JSON the backend persists.

### Database (MongoDB)
- Authoritative metadata: users, cases, hearings, events, documents, document pages, analyses. `python-ai` writes nothing here.
- Filesystem (`backend/uploads/<caseId>/`) = authoritative uploaded files.
- ChromaDB (`python-ai/vectorstore/`, gitignored) = retrieval/vector layer, regenerable from `DocumentPage`.

### Security / env
- `backend/.env.example` & `python-ai/.env.example` document every var (JWT pair, rate limits, `UPLOADS_DIR`, pipeline knobs, `ANALYSIS_MAX_CHARS`, `LLM_PROVIDER`, `GEMINI_API_KEY`, `OCR_LANG`, …).
- Uploads are server-named with whitelisted extensions + MIME checks, 25 MB/file, 10 files/request; `storagePath`/`extractedText` never serialize to clients.

---

## 4. What is actually implemented vs. what was only planned

**Real, end to end:**
- Register / login / logout / refresh / profile edit, dark mode, en/kn language switching, full sidebar/topbar shell.
- Full case CRUD (create/view/edit/soft-delete+undelete/archive/restore/status-change/pin), parties, notes, hearings with atomic numbering + 7-status lifecycle + `Case.nextHearingDate`, event-log timeline & activity, case search/filter.
- Document upload + processing pipeline: OCR → extraction → page units → chunking → embeddings → ChromaDB, status lifecycle (`pending→processing→completed|failed`), retry, download, soft-delete, Documents tab with per-file docType upload, auto-polling.
- Module 5 analysis: per-case `CaseAnalysis`, synchronous generate/regenerate, strict document/page provenance, curated IPC↔BNS equivalents, Kannada detection + Kannada output, retrievalUsed flag, real AI Analysis + Applicable Laws tabs.

**Only planned / scaffolded (clearly labeled in UI, nothing faked):**
- Evidence, Witnesses, Judgments, Courtroom Strategy, Reports per-case tabs → generic `CaseComingSoonTab`.
- All Legal Research Center tools (Judge Research, Constitution, BNS/BNSS/BSA, Supreme/High Court, Judgment Search, Case Comparison, Evidence Analyzer, Legal Dictionary, Bookmarks, AI Assistant) → `ComingSoonView`.
- Practice Management tools (Clients, cross-case Hearings calendar, Tasks, Calendar, Reports, Analytics, Settings) → `ComingSoonView` (per-case hearings are real).
- Global search → captures query only, no real index.
- Case Activity → real `CaseEvent` log, not a field-level audit log.
- Case-workspace chat/rich cards → sample preview screen only (`/app/cases/preview`).

---

## 5. Current issues / incomplete areas

**Known gaps & follow-ups (tracked in `PROJECT_MEMORY.md`):**
1. **Module 5 remainder:** BNS / BNSS / BSA Legal Research Center sidebar pages are planned Module 5 work, not yet built (the analysis output can later back them).
2. **i18n gaps:** `Profile.jsx` labels/form and some `Landing.jsx` body copy still English-only; all case-management pages English-only (tracked, not silently skipped).
3. **Kannada legal-terminology review** needed before real submission/demo use.
4. **Language threading:** analysis threads en/kn; the Module 4 document pipeline still hardcodes `language=en` (OCR lang is globally configurable via `OCR_LANG`). Per-document language routing + a **multilingual embedding model** remain natural next steps.
5. **No Trash UI:** case soft-delete has a restore banner but no browsable list; hearing/document soft-delete has no restore endpoint/UI (physical files retained on disk).
6. **`spacy`/`nltk` in requirements** are installed but not yet used (English-only spaCy NER was deferred; the LLM handles entities).
7. **No automated test suite in the repo** — acceptance tests were run live at each module checkpoint (in-memory MongoDB + backend + python-ai with `LLM_PROVIDER=stub`), but `npm test` is a placeholder until Module 9.
8. **Multi-user case assignment UI** — `assignedUsers` exists at data layer; no picker (needs a "list org users" endpoint).
9. **Cross-case Hearings calendar** — per-case hearings real; aggregation view not.
10. **`hearingCounter`** is internal bookkeeping; bulk-import scripts must bump it or the unique index could collide.

---

## 6. Phases to implement (future modules)

- **Module 5 (remaining):** BNS / BNSS / BSA reference pages in the Legal Research Center.
- **Module 6 — Similar judgments (RAG):** also backs Judge Research, Constitution, Supreme/High Court, Judgment Search, Case Comparison, Legal Dictionary. Likely includes the multilingual embedding model + re-embedding.
- **Module 7 — Arguments + evidence scoring:** prosecution/defence drafting + evidence strength (weak/medium/strong) → also backs Evidence Analyzer.
- **Module 8 — Legal chatbot:** grounded Q&A over case documents, refuses out-of-context → also backs AI Assistant (replaces sample data in case-workspace preview).
- **Module 9 — PDF reports:** ReportLab assembly → also backs the Reports sidebar page.
- **Module 10 — Polish/logging/integration pass:** full i18n, audit log, multi-user assignment, cross-case calendar, Clients/Tasks/Calendar/Analytics/Settings/Bookmarks, Trash/restore, test suite, deployment hardening.

---

## 7. Future features and improvements

- Grounded legal chatbot with citations (Module 8).
- Similar-judgment retrieval with case-comparison diffing (Module 6).
- Prosecution/defence argument generation + evidence-strength scoring with rationale (Module 7).
- One-click PDF case report export (Module 9).
- Multilingual (en/kn) embeddings so Kannada documents get real similarity search.
- Full field-level audit log for the Activity tab.
- Global search over cases + documents + laws.
- Admin/org features: client directory, cross-case hearing calendar, tasks, analytics dashboards, bookmarks.
- Trash/restore UX and a cleanup job for physically-deleted uploads.

---

## 8. Gemini API integration and where it fits

- **Where:** `python-ai` only. The public backend never holds the Gemini key.
- **How:** `services/llm_service.py` wraps `google-generativeai` with JSON-only extraction prompts. Provider is selected by `LLM_PROVIDER`:
  - `gemini` (default) — needs `GEMINI_API_KEY` + `GEMINI_MODEL` (default `gemini-1.5-flash`).
  - `stub` — deterministic canned output (with real Kannada text for `language='kn'`) so the pipeline and acceptance tests run with no key.
- **What it powers today:** Module 5 case analysis — summary + key points, document timeline, entities, applicable IPC/BNS/BNSS/BSA laws with equivalents, per-document breakdown. Multilingual, so `kn` narrative output works.
- **What it will power:** Module 6 similar judgments, Module 7 arguments + evidence scoring, Module 8 grounded chat — all reusing the same `rag_service` + LLM plumbing.

---

## 9. Testing / deployment readiness

- **Testing approach to date:** live HTTP acceptance/regression suites run at each module checkpoint — in-memory MongoDB + backend + python-ai with `LLM_PROVIDER=stub`, covering lifecycle, provenance, Kannada Unicode output, IPC→BNS equivalents, access control, python-ai-unreachable handling, events, and module 3/4 regression sweeps. **No committed automated suite yet** (`backend npm test` is a placeholder; frontend has `eslint` lint but no test runner).
- **OCR caveat:** Tesseract is a **system dependency**, not pip — needs `tesseract-ocr` (+ `tesseract-ocr-kan` for Kannada) installed; `TESSERACT_CMD`/`OCR_LANG` configurable.
- **Deployment readiness:** dev-ready, not production-ready. Missing: automated CI tests, Docker/containerization, managed MongoDB (swap `MONGO_URI`), hosted Chroma persistence, secret management, HTTPS/CORS hardening for prod, PM2/systemd or container orchestration, and final i18n + legal-terminology review.

---

## 10. Overall project completion percentage

| Module | Scope | Status | Est. |
|---|---|---|---|
| 1 | Architecture & scaffolding | ✅ | 100% |
| 2 | Authentication | ✅ | 100% |
| — | Sidebar/topbar shell, i18n, IA | ✅ | 100% |
| 3 | Case Management + Hearings | ✅ | 100% |
| 4 | Document pipeline (Ph 1+2) | ✅ | 100% |
| 5 | Case analysis (Ph 3) | ✅ analysis; BNS/BNSS/BSA pages pending | ~90% |
| 6 | Similar judgments (RAG) | ⬜ | 0% |
| 7 | Arguments + evidence scoring | ⬜ | 0% |
| 8 | Legal chatbot | ⬜ | 0% |
| 9 | PDF reports | ⬜ | 0% |
| 10 | Polish/logging/integration | ⬜ | 0% |

**Overall: ≈ 50%** (5 of 10 modules, Module 5 ~90% complete).

---

## 11. Recommended roadmap to finish LawGPT

1. **Close out Module 5** — build BNS / BNSS / BSA reference pages backed by the analysis output + curated law data (~1 week).
2. **Module 6 — Similar judgments (RAG)** — seed a judgment corpus, case-scoped similarity search, Judgment Search + Comparison views; add a multilingual embedding model and re-embed (`DocumentPage` regeneration story already documented) (~2–3 weeks).
3. **Module 7 — Arguments + evidence scoring** — extend `llm_service`/`rag_service` with two new prompt strategies; Evidence Analyzer page (~1–2 weeks).
4. **Module 8 — Legal chatbot** — grounded Q&A with citation chips; wire real chat into the case workspace (~1–2 weeks).
5. **Module 9 — PDF reports** — ReportLab assembly from `CaseAnalysis` + evidence + timeline; Reports page (~1 week).
6. **Module 10 — Integration & polish** — test suite (backend `npm test` + a runner), full i18n, audit log, Trash/restore, multi-user assignment, cross-case calendar, Clients/Tasks/Analytics/Settings/Bookmarks, global search index (~2–3 weeks).
7. **Final release prep** — Kannada legal-terminology review, Dockerize all three services, seed demo data, write the viva defense notes, final demo script.

**Guardrails throughout:** never break the Module 4 ownership boundary (Mongo = metadata, backend fs = files, Chroma = vectors, python-ai = stateless AI); keep LLM behind `LLM_PROVIDER` so tests never need a key; keep the curated IPC↔BNS map as the only source of law `equivalent`s; update `PROJECT_MEMORY.md` with every module.
