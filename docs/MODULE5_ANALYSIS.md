# Module 5 Phase 3 — Legal-Document Analysis Layer

This document describes the code that actually exists after Module 5 Phase 3 —
the case-analysis layer built on top of the (unchanged) Module 4 document
pipeline. Analysis = structured LLM analysis of a case's processed documents:
summary + key points, document-derived timeline, entities, and applicable
IPC/BNS/BNSS/BSA references, with a per-document breakdown. Everything is
provenance-tracked to the source page.

---

## 1. What this phase delivers

- **`CaseAnalysis`** Mongoose model (one record per case, regenerated
  idempotently) — analysis results are persisted in MongoDB and never live on
  the `Case` model or in ChromaDB.
- **Backend endpoints** `POST /cases/:caseId/analysis` (synchronous run/re-run)
  and `GET /cases/:caseId/analysis`, under the same
  `protect → loadCase → requireCaseAccess` chain as Documents/Hearings.
- **python-ai analysis service**: `POST /analysis/case` — stateless, receives
  the case's authoritative page units from the backend and returns a structured
  analysis. LLM provider is behind `LLM_PROVIDER` (`gemini` | `stub`) so
  deterministic acceptance tests run without a Gemini API key.
- **Frontend**: the `ai-analysis` and `laws` case tabs become real
  (`CaseAIAnalysisTab.jsx`, `CaseLawsTab.jsx`) with a "Generate analysis" action.
- **CaseEvent**: `AI_ANALYSIS_STARTED` / `AI_ANALYSIS_COMPLETED` /
  `AI_ANALYSIS_FAILED` event types + icons.

Module 4's ingestion pipeline (extraction/OCR/chunking/embeddings), its
worker, `DocumentPage` provenance, and the ChromaDB vector layer are all
**unchanged**.

## 2. Lifecycle

Synchronous for this checkpoint (the HTTP request is the run; the `status`
field is retained so a later module can convert to a background worker without
redesigning the model):

```
pending → processing → completed
pending → processing → failed   (with a readable error; never a stale 'processing' row)
```

The controller claims the record (`pending → processing`) before calling
python-ai; on any failure the same record is flipped to `failed` with the
error before the error is returned — a failed/partial analysis is never left
marked `completed`.

## 3. `CaseAnalysis` model (`backend/src/models/CaseAnalysis.js`)

| Field | Type | Notes |
|---|---|---|
| `caseId` | Case ref, required, **unique** | One analysis per case; re-run replaces it |
| `createdBy` | User ref, required | |
| `status` | `pending`/`processing`/`completed`/`failed` | Retained for future async conversion |
| `requestLanguage` | `en`/`kn` | Narrative output language used |
| `retrievalUsed` | Boolean | Whether English-only Chroma retrieval grounded the analysis |
| `summary` | `{ text, keyPoints[] }` | Case-level summary |
| `timeline` | subdocs `{ event, date?, text?, sourceDocumentId, pageNumber }` | Document-derived chronology |
| `entities` | subdocs `{ type, name, mentions, sourceDocumentId, pageNumber }` | person/org/date/amount/place/vehicle/statute/other |
| `laws` | subdocs `{ code, section, label, description, relevance, equivalent, sourceDocumentId, pageNumber }` | `equivalent` only from curated reference data |
| `documents` | per-doc subdocs `{ documentId, documentName, docType, summary, keyPoints[], entities[], laws[], charCount }` | Breakdown; entities/laws derived from the case-level lists by `sourceDocumentId` |
| `error`, `generatedAt` | | Failure message / completion timestamp |

**Provenance rule**: every timeline/entity/law carries `sourceDocumentId` and
`pageNumber` where the LLM anchored it. The python-ai layer validates a cited
page against the pages it actually sent — a page number the LLM could not have
seen is dropped to `null`, never kept.

## 4. Backend orchestration

`analysisService.js` (backend) builds the payload from the authoritative
`DocumentPage` units and calls python-ai; `analysisController.js` owns the
record lifecycle and events.

- Only `status: 'completed'`, non-deleted `Document`s are analyzable; none →
  `400`.
- The payload is capped at `ANALYSIS_MAX_CHARS` (default 30000); **whole pages
  are dropped from the end** (never cut mid-page) and the request flags
  `truncated`.
- python-ai unreachable → clean `502`; pipeline/LLM error → `422` with the
  detail. Both persist the failed record first.

## 5. python-ai (`python-ai/app/`)

- `services/llm_service.py` — Gemini wrapper (JSON-only extraction) plus the
  **stub provider**: `LLM_PROVIDER=stub` returns deterministic canned output
  (with real Kannada text when `language='kn'`) so the full pipeline can be
  tested without a Gemini key. `GEMINI_API_KEY` / `GEMINI_MODEL` configurable.
- `services/analysis_service.py` — orchestrator: Kannada detection →
  optional English retrieval grounding → prompt assembly → LLM → normalization
  → structured result.
- `services/rag_service.py` — English-only optional grounding. Reuses the
  existing case-scoped Chroma search (`document_pipeline_service.search_document`,
  the Module 4 vector layer — **unchanged**); excerpts are appended to the
  prompt for grounding/citation. Degrades gracefully to full text on any
  retrieval failure.
- `nlp/ipc_bns_map.py` — curated IPC↔BNS correspondence (base-section level,
  from the BPRD correspondence table and 2025-verified references; ~40 common
  sections). `normalize_law()` emits an `equivalent` cross-reference **only**
  from this data; unknown equivalences stay explicitly empty. Never invented.

### Kannada handling

- Kannada is detected by Unicode block (U+0C80–U+0CFF), deterministic.
- **If Kannada is detected anywhere in the case text, English-only Chroma
  retrieval is bypassed entirely** and the analysis uses the authoritative
  full page text.
- `language` (`en`/`kn`) selects the narrative output language; Gemini is
  multilingual, so `kn` summaries/labels work. UTF-8 is preserved end-to-end.

### The bge-small-en-v1.5 limitation

Phase 3 does **not** replace the embedding model. Analysis is an LLM task over
authoritative extracted text; the English-oriented embedding model only powers
similarity retrieval, which is at most an optional English-only grounding aid
and is bypassed for Kannada. A multilingual embedding model / re-embedding is a
Module 6 concern, explicitly out of scope here.

## 6. API endpoints

Backend (base `http://localhost:5000/api`, all require a Bearer token):
```
POST /api/cases/:caseId/analysis      body: { language?: 'en'|'kn' }  → 201 { analysis } | 400 (no processed docs) | 502 (python-ai unreachable) | 422 (analysis failed)
GET  /api/cases/:caseId/analysis      → 200 { analysis } | 404 (never run)
```
python-ai (base `http://localhost:8000`):
```
POST /analysis/case   body: { caseId, language, truncated, documents:[{documentId, documentName, docType, pages:[{pageNumber,text,charCount}]}] } → AnalysisResult
```

## 7. Frontend

- `services/analysisService.js` — `runAnalysis(caseId, language)` /
  `getAnalysis(caseId)`.
- `CaseAIAnalysisTab.jsx` (`/app/case/:caseId/ai-analysis`) — generate /
  regenerate button (language follows the app's current i18n language), states
  for empty / loading / failed / completed; renders summary+key points,
  document timeline, entities grouped by type, applicable laws (with `≈ BNS …`
  equivalents from curated data), and a per-document accordion with sources.
- `CaseLawsTab.jsx` (`/app/case/:caseId/laws`) — the applicable-laws view from
  the same analysis record.
- `CaseDetailLayout.jsx` — `ai-analysis` and `laws` promoted from
  `COMING_SOON_TABS` to `REAL_TABS`; `AppRoutes.jsx` gained the two routes.
- Case-workspace UI remains English-only (consistent with the existing case
  pages — see PROJECT_MEMORY follow-up #1).

## 8. IPC↔BNS reference data (`python-ai/app/nlp/ipc_bns_map.py`)

Curated, source-verified subset (BPRD correspondence table + 2025-verified
references): IPC 302→BNS 103, 304→105, 304A→106, 304B→80, 306→108, 307→109,
323→115, 324/326→118, 325→117, 354→74, 375→63, 376→64, 420→318(4), 498A→85,
etc. Matching is at base-section level; `IPC 377 → "Removed from BNS"` is
handled explicitly. This is educational data flagged for a legal review pass;
no equivalence is ever invented.

## 9. Environment variables added

Backend (`backend/.env.example`): `ANALYSIS_MAX_CHARS` (default 30000).

python-ai (`python-ai/.env.example`): `LLM_PROVIDER` (`gemini`|`stub`),
`GEMINI_MODEL` (default `gemini-1.5-flash`), `ANALYSIS_USE_RETRIEVAL`
(default `true`), `ANALYSIS_TOP_K` (default 8). (`GEMINI_API_KEY` already
existed in the example.)

## 10. Explicitly NOT implemented in this phase

- BNS / BNSS / BSA research sidebar pages (future Module 5 work).
- Cross-document / similar-judgments RAG (Module 6), evidence/witness/strategy
  analysis (Modules 7–10), PDF reports (Module 9).
- A multilingual embedding model and document re-embedding (Module 6).
- spaCy NER pipeline (English-only; the multilingual LLM handles entity
  extraction including Kannada — the docs' "IPC↔BNS section reference data"
  part of `nlp/` is what this phase implements).
- Async analysis worker (the `status` field is ready for it, but Phase 3 runs
  synchronously by design).

## 11. Verification

See the live acceptance/regression test run recorded with the Module 5 Phase 3
commit: full HTTP suite against MongoDB (in-memory) + backend + python-ai with
`LLM_PROVIDER=stub` covering the lifecycle, provenance, Kannada output
(asserting actual Kannada Unicode in the response), retrieval bypass/use, the
curated IPC→BNS equivalent, access control, python-ai-unreachable handling,
events, and a Module 3/4 regression sweep.
