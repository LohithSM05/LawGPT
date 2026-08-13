# Module 4 — Case Documents (Phases 1 + 2: foundation + processing pipeline)

This document describes the code that actually exists after Module 4 — the
document backend foundation (Phase 1) plus the full processing pipeline
(Phase 2: OCR → extraction → page units → chunking → embeddings → ChromaDB),
the python-ai service, and the frontend Documents tab.

---

## 1. What this phase delivers

- `Document` Mongoose model, following the `Case`/`Hearing` conventions.
- Nested routes under `/api/cases/:caseId/documents` with the same
  `protect → loadCase → requireCaseAccess` chain as Hearings. **No flat
  `/documents` route exists** — a document only ever exists inside a case.
- Disk upload via multer into a gitignored `uploads/<caseId>/` directory
  (configurable via `UPLOADS_DIR`, defaults to `<repo>/backend/uploads`),
  with MIME/extension and file-size validation.
- Multi-file upload in one request (`documents` multipart field, up to 10
  files, 25 MB each), with an optional per-file `docTypes` JSON array (Phase
  2) aligned by index with `documents[]`; the legacy single `docType` still
  applies as a fallback.
- Document list / detail / soft-delete / secure download.
- **Phase 2**: the full processing pipeline — format detection → PDF/DOCX/TXT
  extraction → per-page OCR fallback for scanned pages and images → cleaning →
  ordered page-level text units (`DocumentPage`) → page-aware chunking →
  embeddings → ChromaDB — run by a background worker in the backend that
  streams each uploaded file to the (stateless) python-ai service.
- `POST /:documentId/process` (re)queues a document for the pipeline;
  `GET /:documentId/pages` returns its ordered page-level text units.
- Real `documentCount` on `GET /cases/:id` (was a hardcoded `0`).
- `DOCUMENT_UPLOADED` / `DOCUMENT_DELETED` / `DOCUMENT_PROCESSING_STARTED` /
  `DOCUMENT_PROCESSED` / `DOCUMENT_PROCESSING_FAILED` `CaseEvent` types +
  icons.

## 2. Document model (`backend/src/models/Document.js`)

| Field | Type | Notes |
|---|---|---|
| `caseId` | Case ref, required, indexed | |
| `createdBy` | User ref, required | Set from the authenticated user |
| `originalName` | String, required | The uploader's filename — what the client sees on download; never used for a filesystem path |
| `storagePath` | String, required, `select: false` | Server-generated relative path under the uploads root (`<caseId>/<randomName>`); never derived from user input, so no traversal possible |
| `mimeType` | String, required | The declared MIME type at upload |
| `size` | Number, required | Bytes |
| `docType` | String, free text, default `''` | FIR, complaint, statement, chargesheet, court document, … — **not** an enum, so new kinds need no migration (same pattern as `Case.caseType`) |
| `status` | enum: `pending`, `processing`, `completed`, `failed` | Driven by the Phase 2 pipeline worker; `processing` is transient |
| `extractedText` | String, `select: false` | Full normalized text set by the pipeline; kept out of list/detail/create responses |
| `chunkCount` | Number, default `0` | Set by the pipeline |
| `pageCount` | Number, default `0` | Ordered page-level text units in `DocumentPage` (Phase 2) |
| `processedAt` | Date, null | When the pipeline last completed |
| `error` | String, default `''` | Processing error message (Phase 2) |
| `isDeleted`, `deletedAt` | Boolean, Date | Soft delete — see §6 |

`storagePath` and `extractedText` are excluded from **all** JSON responses
(`select: false` at query level + a `toJSON` transform that strips them even
from the create response) — clients never see the server's on-disk layout,
and large text never bloats a case payload. `downloadDocument` is the only
code path that re-selects `storagePath` (`+storagePath`), and it uses the raw
document, never a serialized copy.

Indexes: `{ caseId: 1, createdAt: 1 }` (list order), `{ caseId: 1, status: 1 }`.

## 3. Routing & authorization

`backend/src/routes/documentRoutes.js`, mounted in `routes/index.js` before
`/cases` (same specificity-first ordering as the hearings mount):

```js
router.use(protect, loadCase, requireCaseAccess);
router.post('/', upload.array('documents', MAX_FILES_PER_REQUEST), documentController.uploadDocuments);
router.get('/', documentController.listDocuments);
router.get('/:documentId', documentController.getDocument);
router.delete('/:documentId', documentController.deleteDocument);
router.get('/:documentId/download', documentController.downloadDocument);
```

`loadCase` runs before multer so the upload destination can use `req.case._id`
to build `uploads/<caseId>/`. Access rules are identical to Hearings: the
case's creator, anyone in `assignedUsers`, or an admin. An unrelated user
gets a `403` on every document route of a case they can't access.

## 4. Upload (`backend/src/config/upload.js`)

- **Storage**: `multer.diskStorage`; destination `uploads/<caseId>/` created
  on demand with `fs.mkdirSync(dir, { recursive: true })`. Stored filenames
  are server-generated (`<timestamp>-<randomHex><ext>`) — the user's
  `originalName` never reaches the filesystem, and the real extension is kept
  so future content sniffing/OCR works.
- **Allowed formats** (extension → known MIME types):
  PDF, PNG, JPG/JPEG, DOCX, TXT.
- **Filter logic**: the extension must have a known mapping **and** the
  declared MIME must either match that mapping or be
  `application/octet-stream`/empty (some browsers send no useful MIME for
  file inputs — the allowed extension is enough in that case). Anything else
  is rejected with a `400`; `.exe`, `.js`, `.html`, a `.txt` claiming to be
  `application/pdf`, etc. are all refused. This file never executes uploaded
  content — the filter is about not silently accepting junk/unsupported
  formats, not about sandboxing.
- **Limits**: 25 MB per file, 10 files per request. Oversize / too-many-file
  errors are `MulterError`s mapped to clean `400`s by the centralized
  error middleware (see §7), e.g. `File too large`, `Too many files in a
  single request`.
- **Multipart fields**: `documents` (the files) + optional `docType` text
  field that applies to **all** files in the request (trimmed, capped at
  100 chars). Per-file `docType` is deferred to Phase 2 alongside the upload
  UI, which will own how that maps onto the request.

### Upload controller behavior

- Empty upload (no `documents` field) → `400`.
- For each file: `Document.create(...)` with `status: 'pending'`, then a
  `DOCUMENT_UPLOADED` `CaseEvent` (with `{ documentId, fileName, size }` in
  `metadata`). If a `Document` insert fails, the just-written file is
  unlinked from disk (best-effort) so no orphaned file is left behind.

## 5. Endpoints

Base: `http://localhost:5000/api` · all require `Authorization: Bearer <token>`.

```
POST   /cases/:caseId/documents                 multipart: documents[] + docTypes[]/docType → { documents, count }
GET    /cases/:caseId/documents                 excludes soft-deleted, sorted -createdAt
GET    /cases/:caseId/documents/:documentId      metadata + status (no storagePath/extractedText)
DELETE /cases/:caseId/documents/:documentId      soft delete
GET    /cases/:caseId/documents/:documentId/download   streams the file as an attachment
POST   /cases/:caseId/documents/:documentId/process    (Phase 2) queue for (re)processing → 202
GET    /cases/:caseId/documents/:documentId/pages      (Phase 2) ordered page-level text units
```

`POST /:documentId/process` sets `status: 'pending'` (from `failed` — retry —
or a fresh upload), clears `error`, and wakes the worker; it returns `409`
if the document is already `processing`. `GET /:documentId/pages` returns
`{ pages: [{ pageNumber, text, charCount }] }` sorted by `pageNumber`.

Plus the updated `GET /cases/:id` stats: `documentCount` is now counted from
the real `Document` collection (`{ caseId, isDeleted: { $ne: true } }`);
`evidenceCount` stays `0` (Evidence is not implemented).

## 6. Soft delete

`DELETE` sets `isDeleted: true` / `deletedAt: new Date()` — the DB record is
**not** removed, and the physical file is **not** deleted (a later phase /
cleanup job owns permanent file removal). Soft-deleted documents:
- disappear from `listDocuments` and stop counting toward `documentCount`;
- are treated as not-found (`404`) by detail **and** download — this is a
  deliberate difference from Hearings. Hearings stay fetchable by ID after
  deletion because `previousHearingId` links and Timeline entries point at
  them; nothing links to a deleted document, and download must refuse it
  anyway. No restore endpoint/UI exists yet.

## 7. Phase 2 — the processing pipeline

### 7.1 Orchestration and the ownership boundary

A **background worker** (`backend/src/services/documentPipelineService.js`,
started by `server.js`) is the only thing that moves documents out of
`pending`. It is an in-process, MongoDB-polled loop (no Redis/BullMQ —
single-instance project): each tick first requeues crashed jobs (a document
left in `processing` longer than `DOC_PROCESSING_TIMEOUT_MS`), then processes
every `pending` document sequentially. Claims are atomic —
`Document.findOneAndUpdate({ _id, status: 'pending' }, { status: 'processing' })`
— so a restart or a concurrent tick can never process the same document twice.

The worker streams the uploaded file (from the authoritative filesystem) to
the **python-ai** FastAPI service as multipart, and python-ai stays stateless
per request: it never touches MongoDB or the uploads directory. On success it
returns ordered page-level text units plus chunk/page counts; the worker then
persists them and flips the document to `completed`. This preserves the
single-ownership boundary from ARCHITECTURE.md §3: MongoDB = metadata,
filesystem = uploaded files, ChromaDB = vectors.

**Failure semantics:** if python-ai is unreachable (network error), the
document is requeued to `pending` and retried next tick — that is not the
document's fault. Any pipeline/validation error response marks the document
`failed` with a readable `error` (FastAPI `detail`, JSON-stringified if it is
a validation array). `POST /:documentId/process` resets `failed → pending` for
retry.

### 7.2 python-ai service (`python-ai/app/`)

- `core/config.py` — pydantic-settings: `EMBEDDING_MODEL`,
  `CHROMA_PERSIST_DIR`, `CHROMA_COLLECTION`, `OCR_MIN_TEXT_CHARS`,
  `OCR_RASTER_DPI`, `TESSERACT_CMD`, `CHUNK_SIZE`, `CHUNK_OVERLAP`.
- `services/extraction_service.py` — format detection (extension + MIME) then:
  PDF via PyMuPDF (per-page text layer, falling back to OCR when a page's text
  is below `OCR_MIN_TEXT_CHARS`), DOCX via python-docx (single page unit —
  DOCX has no intrinsic page concept), TXT (single page), images (single page,
  straight to OCR).
- `services/ocr_service.py` — pytesseract shell-out to the Tesseract binary
  (`TESSERACT_CMD`, **a system dependency, not a pip package**); PDF pages are
  rasterized at `OCR_RASTER_DPI` before OCR. The OCR language is selected via
  `OCR_LANG` (`eng` default; `kan` or `kan+eng` for Kannada/mixed documents —
  requires the `tesseract-ocr-kan` package, Ubuntu 24.04), passed to
  `image_to_string(lang=...)`.
- `services/cleaning_service.py` — conservative normalization: line endings,
  control/format char removal (keeps `\n`/`\t`), NBSP, zero-width/BOM, space
  and blank-line collapsing. Preserves UTF-8 (including Kannada).
- `services/chunking_service.py` — **page-aware**: the LangChain
  `RecursiveCharacterTextSplitter` runs independently on each page, so a chunk
  never crosses a page boundary; `chunkIndex` is global across the document.
- `services/embedding_service.py` — `BAAI/bge-small-en-v1.5`
  (sentence-transformers), lazy-loaded once and cached; 384-dim, L2-normalized.
- `services/vectorstore_service.py` — Chroma `PersistentClient` at
  `CHROMA_PERSIST_DIR` (gitignored), single collection `CHROMA_COLLECTION`.
  Chunk metadata carries `caseId`, `documentId`, `pageNumber`, `chunkIndex`,
  `chunkCount`, `documentName`, `docType` — this is how case scoping and
  page/document provenance survive the round-trip. Reprocessing deletes a
  document's prior chunks before upserting (idempotent).
- `services/document_pipeline_service.py` — the orchestrator: detect → extract
  → clean → skip empty pages (keeping real `pageNumber`) → chunk → embed →
  Chroma upsert → structured result. No extractable text → `PipelineError`
  (HTTP 422 → document `failed`).

### 7.3 `DocumentPage` and provenance

`DocumentPage` (MongoDB) is the durable ordered page-level text unit layer —
the page-provenance source of truth. `{ documentId, pageNumber }` is unique;
rows are replaced wholesale on reprocessing. Chunks live **only** in ChromaDB
and can be re-embedded from `DocumentPage` if the vector store is regenerated.

### 7.4 Retrieval infrastructure (not Module 5)

`POST /documents/search` (`{ caseId, query, topK, language }`) runs a
case-scoped similarity query (`where: { caseId }`) and returns chunks with
their provenance and distance. This exists to verify the vector layer and to
serve Modules 5/6 — it is not Module 5 analysis.

## 8. Error handling
No new pattern — everything flows through the existing
`ApiError` / `ApiResponse` / `asyncHandler` / centralized error middleware.
The only addition is a `MulterError` branch in `errorMiddleware.js` so file
upload failures (`LIMIT_FILE_SIZE`, `LIMIT_FILE_COUNT`,
`LIMIT_UNEXPECTED_FILE`) return clean `400`s instead of raw `500`s. The
multer `fileFilter` rejects unsupported types by passing an `ApiError` to
multer's callback, which surfaces through the same middleware. Pipeline
failures are *persisted*, not returned: the worker captures python-ai's error
payload into `Document.error` and emits a `DOCUMENT_PROCESSING_FAILED` event.

## 9. CaseEvent integration

`CaseEvent.EVENT_TYPES` grew from 25 to 27 with `DOCUMENT_UPLOADED` and
`DOCUMENT_DELETED` (Phase 1), then to 30 with
`DOCUMENT_PROCESSING_STARTED` / `DOCUMENT_PROCESSED` /
`DOCUMENT_PROCESSING_FAILED` (Phase 2). Uploads emit one `DOCUMENT_UPLOADED`
event per file; soft-deletes one `DOCUMENT_DELETED`; the pipeline worker emits
the three processing events (the failure event carries the error in
`description` and `metadata.error`). `config/caseEventIcons.js` maps them to
`FileUp` / `FileX` / `Loader2` / `FileCheck` / `AlertTriangle`.

## 10. Testing performed (Phases 1 + 2 verification)

**Phase 1** — a full HTTP test suite against a live backend + MongoDB (33 checks),
covering: register/login/create-case; Module 3 hearing create/list regression;
document upload (single, multi-file, DOCX+JPG, DOCX-as-octet-stream);
unsupported-type rejection (`.exe`, `.js`, MIME-mismatched `.txt`);
oversized-file rejection (26 MB → clean `400`); >10-file rejection;
empty-upload rejection; list excludes deleted; detail/download of a deleted
document → `404`; byte-exact download; `documentCount` moving 0→1→4→3 across
uploads/deletes; `DOCUMENT_UPLOADED`×4 and `DOCUMENT_DELETED`×1 events;
cross-user `403` on list and upload; unauthenticated `401`; invalid document
id → `400`; per-case directory layout on disk; soft-deleted file retained on
disk. A separate Module 3 regression sweep (13 checks: case CRUD, status,
archive/restore/pin, parties, notes, hearing transition +
`nextHearingDate` recalculation, hearing soft delete, timeline, undelete) is
also green.

**Phase 2** — the full pipeline was verified end to end against a live stack
(MongoDB in-memory + backend + python-ai + a portable Tesseract 5.3.4 binary;
30 checks, all green): register/login/create-case; multi-file upload with
per-file `docTypes`; automatic `pending → processing → completed` for a 2-page
text PDF, DOCX, TXT, **and an image processed by OCR**; `DocumentPage` rows
with correct `pageNumber` provenance; `GET /pages`; real page/chunk counts;
`documentCount`; case-scoped Chroma search with provenance metadata (and empty
results for an unknown case); cross-user `403` and unauthenticated `401`;
`POST /:documentId/process` → `202` then re-processing; soft-delete
(list exclusion, `404` detail/download, count decrement); intact download.
A stub-embedding smoke test also exercises the python-ai pipeline stages
directly (extraction, cleaning, page-aware chunking, Chroma upsert/search,
reprocess idempotency, empty-document rejection).

## 11. Explicitly NOT implemented in this phase

- Page preview in the Documents tab (the `GET /:id/pages` endpoint already
  serves the ordered page units; the UI just doesn't render them yet).
- Physical-file deletion / Trash / restore UI for documents (soft-deleted
  documents are `404` on detail/download; the file stays on disk).
- Evidence, Witnesses, RAG-powered features, LLM analysis — Modules 5–10.
- Kannada OCR: the language is now selectable globally via `OCR_LANG` (e.g.
  `kan` / `kan+eng`, installed via `tesseract-ocr-kan`), but OCR is still
  **per-document**-blind (the pipeline hardcodes `language=en` from the
  backend) and the embedding model remains English-only. The `language` field
  is threaded through the schemas but the frontend is not wired to send it yet.
- Real tesseract installed via `apt` — the E2E used a portable binary; on
  this machine OCR needs `sudo apt install -y tesseract-ocr` (plus
  `tesseract-ocr-kan` for Kannada; see PROJECT_MEMORY.md, "Tesseract is a
  system dependency").
