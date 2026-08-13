const mongoose = require('mongoose');

// One ordered page-level text unit per processed document (Module 4 Phase 2).
// The pipeline (extraction/OCR) produces pages and the backend persists them
// here, so ordered page-level text and page provenance live in MongoDB — the
// authoritative metadata layer. Chunks derived from these pages live only in
// ChromaDB (the retrieval/vector layer) and can be re-embedded from here if
// the vector store is ever regenerated. A document's pages are replaced
// wholesale on reprocessing (delete + re-insert), so uniqueness per document.
const documentPageSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    // The page's position in the original source document (e.g. the real PDF
    // page number). Non-contiguous after OCR-empty pages are skipped — the
    // number always reflects the source, never an index into this collection.
    pageNumber: { type: Number, required: true },
    text: { type: String, required: true },
    charCount: { type: Number, required: true },
  },
  { timestamps: true }
);

documentPageSchema.index({ documentId: 1, pageNumber: 1 }, { unique: true });
documentPageSchema.index({ caseId: 1, documentId: 1 });

const DocumentPage = mongoose.model('DocumentPage', documentPageSchema);

module.exports = DocumentPage;
