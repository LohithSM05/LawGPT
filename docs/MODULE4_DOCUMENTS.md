# Module 4 — Case Documents (Phase 1: Backend Foundation)

This document describes the code that actually exists after Module 4 Phase 1
— the document backend foundation. OCR → extraction → chunking → embeddings
→ vector store are **not** implemented yet (Phase 2+). The frontend upload
UI is also not built yet (see "Explicitly NOT implemented" below).

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
  files, 25 MB each). Each accepted file becomes a `Document` with
  `status: 'pending'` — no OCR/embeddings in this phase.
- Document list / detail / soft-delete / secure download.
- Real `documentCount` on `GET /cases/:id` (was a hardcoded `0`).
- `DOCUMENT_UPLOADED` / `DOCUMENT_DELETED` `CaseEvent` types + icons.

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
| `status` | enum: `pending`, `processing`, `completed`, `failed` | Phase 1 only ever sets `pending`; the others are driven by the Phase 2 pipeline |
| `extractedText` | String, `select: false` | Populated by Phase 2 OCR; kept out of list/detail/create responses |
| `chunkCount` | Number, default `0` | Phase 2 chunking |
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
POST   /cases/:caseId/documents                 multipart: documents[] + docType?   → { documents, count }
GET    /cases/:caseId/documents                 excludes soft-deleted, sorted -createdAt
GET    /cases/:caseId/documents/:documentId      metadata + status (no storagePath/extractedText)
DELETE /cases/:caseId/documents/:documentId      soft delete
GET    /cases/:caseId/documents/:documentId/download   streams the file as an attachment
```

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

## 7. Error handling

No new pattern — everything flows through the existing
`ApiError` / `ApiResponse` / `asyncHandler` / centralized error middleware.
The only addition is a `MulterError` branch in `errorMiddleware.js` so file
upload failures (`LIMIT_FILE_SIZE`, `LIMIT_FILE_COUNT`,
`LIMIT_UNEXPECTED_FILE`) return clean `400`s instead of raw `500`s. The
multer `fileFilter` rejects unsupported types by passing an `ApiError` to
multer's callback, which surfaces through the same middleware.

## 8. CaseEvent integration

`CaseEvent.EVENT_TYPES` grew from 25 to 27 with `DOCUMENT_UPLOADED` and
`DOCUMENT_DELETED`. Each upload emits one `DOCUMENT_UPLOADED` event per file;
each soft-delete emits one `DOCUMENT_DELETED`. The frontend
`config/caseEventIcons.js` maps them to `FileUp` / `FileX` so the Timeline
and Activity tabs render them (this is the only frontend change in Phase 1).

## 9. Testing performed (Phase 1 verification)

A full HTTP test suite was run against a live backend + MongoDB (33 checks),
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

## 10. Explicitly NOT implemented in this phase

- Frontend document UI (Documents tab is still `CaseComingSoonTab`; the
  Overview "+ Add Document" button stays disabled). The backend is API-ready;
  Phase 2 wires the UI.
- OCR, extraction, chunking, embeddings, vector store (ChromaDB).
- `status` transitions beyond `pending`; `extractedText` population; `error`.
- Evidence, Witnesses, RAG, LLM analysis — Modules 5–10.
- Physical-file deletion / Trash / restore UI for documents.
