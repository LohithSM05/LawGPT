const mongoose = require('mongoose');

// Processing lifecycle of a case document. Phase 1 (upload) only ever sets
// 'pending' — 'processing'/'completed'/'failed' are driven by the OCR /
// chunking / embedding pipeline in Module 4 Phase 2+.
const DOCUMENT_STATUSES = ['pending', 'processing', 'completed', 'failed'];

// docType is free-text (FIR, complaint, statement, chargesheet, court
// document, ...) — not a Mongoose enum, so new document kinds need no
// migration. Same pattern as Case.caseType / Hearing.hearingType.

const documentSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The name the uploader provided — what the client sees on download.
    // Never used to derive a filesystem path (see storagePath).
    originalName: { type: String, required: [true, 'Original filename is required'], trim: true },
    // Server-generated relative path under the uploads root, e.g.
    // "<caseId>/<randomStoredName>". Never derived from user input, so it
    // cannot contain path-traversal characters. Resolved and bounds-checked
    // at download time (see downloadDocument). select: false keeps the
    // server's on-disk layout out of list/detail responses — same convention
    // as Case.hearingCounter; downloadDocument re-selects it explicitly.
    storagePath: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    docType: { type: String, trim: true, default: '' },
    status: { type: String, enum: DOCUMENT_STATUSES, default: 'pending' },
    // Large field — kept out of list/detail responses by default
    // (select: false) so a handful of documents can't bloat a case payload.
    // Phase 2 populates it via OCR; a future endpoint can re-select it
    // explicitly. Same convention as Case.hearingCounter.
    extractedText: { type: String, default: '', select: false },
    chunkCount: { type: Number, default: 0 },
    error: { type: String, trim: true, default: '' },
    // Soft delete — a document is case history and is never hard-deleted
    // through the normal DELETE endpoint (see documentController.js
    // deleteDocument). Excluded from listDocuments by default. No restore
    // endpoint/UI yet — see PROJECT_MEMORY.md.
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

documentSchema.index({ caseId: 1, createdAt: 1 });
documentSchema.index({ caseId: 1, status: 1 });

// Never serialize server-side internals to clients — not in list, detail,
// or create responses. storagePath reveals the on-disk layout (also
// select: false at the query level), and extractedText can grow large once
// Phase 2 OCR populates it.
documentSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.storagePath;
    delete ret.extractedText;
    return ret;
  },
});

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
module.exports.DOCUMENT_STATUSES = DOCUMENT_STATUSES;
