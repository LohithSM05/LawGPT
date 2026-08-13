const mongoose = require('mongoose');

/**
 * Module 5 Phase 3 — case analysis of the case's processed legal documents.
 *
 * One document per case (`caseId` is unique): regenerating an analysis replaces
 * the whole record (idempotent). The `status` lifecycle mirrors Document:
 *   pending → processing → completed | failed
 * and is retained so a later module can switch to asynchronous processing
 * (a worker polling 'pending'/'processing') without redesigning this model.
 *
 * Analysis never lives on the Case model (the neutral Module 3 entity stays
 * untouched) and never lives in ChromaDB (vectors are for retrieval; analysis
 * is a persisted structured artifact). The authoritative source text is the
 * Module 4 `DocumentPage` page-provenance layer.
 *
 * Provenance: every timeline/entity/law/point that comes from document text
 * carries `sourceDocumentId` (+ `pageNumber` where the LLM anchored it) so each
 * claim is traceable to a real page of a real document. Unknown page numbers
 * are null, never invented.
 */

const ANALYSIS_STATUSES = ['pending', 'processing', 'completed', 'failed'];

// Provenance-bearing subdocument shapes.
const provenanceFields = {
  sourceDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
  pageNumber: { type: Number, default: null },
};

const entitySchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // person | organization | date | amount | place | statute | vehicle | other
    name: { type: String, required: true, trim: true },
    mentions: { type: Number, default: 1 },
    ...provenanceFields,
  },
  { _id: false }
);

const lawSchema = new mongoose.Schema(
  {
    // Canonical code after IPC↔BNS normalization: 'IPC' | 'BNS' | 'BNSS' | 'BSA'
    // | 'Other'. 'unknown' is used when no curated mapping exists and the code
    // cannot be identified — never invented (see nlp/ipc_bns_map.py).
    code: { type: String, required: true },
    // Section number exactly as the source/reference data states it.
    section: { type: String, required: true },
    // Short human label, e.g. "Murder", "Cheating" — from the curated reference
    // data when a mapping matched, otherwise the LLM's label verbatim.
    label: { type: String, default: '' },
    description: { type: String, default: '' },
    relevance: { type: String, default: '' },
    // Cross-reference to the replacement/modern statute, e.g. "BNS 318(4)" for
    // an "IPC 420" mention. ONLY ever populated from the curated IPC↔BNS
    // reference data (nlp/ipc_bns_map.py) — never invented. Empty string when
    // no curated mapping exists (the equivalence stays explicitly unknown).
    equivalent: { type: String, default: '' },
    ...provenanceFields,
  },
  { _id: false }
);

const timelineItemSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, trim: true },
    // Date exactly as the source text states it (raw string — no parsing
    // guesswork; null when the document gives no date).
    date: { type: String, default: null },
    // Supporting quote from the document (trimmed).
    text: { type: String, default: '' },
    ...provenanceFields,
  },
  { _id: false }
);

const documentAnalysisSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    documentName: { type: String, required: true },
    docType: { type: String, default: '' },
    summary: { type: String, default: '' },
    keyPoints: [{ type: String }],
    entities: [entitySchema],
    laws: [lawSchema],
    charCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const caseAnalysisSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, unique: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ANALYSIS_STATUSES, default: 'pending' },
    // Language the analysis was generated in ('en' | 'kn') — the narrative
    // output language requested by the user, recorded for the UI/tests.
    requestLanguage: { type: String, enum: ['en', 'kn'], default: 'en' },
    // Whether English-only ChromaDB retrieval was used as an optional
    // grounding/condensation mechanism (always false when Kannada was
    // detected — retrieval is bypassed for Kannada).
    retrievalUsed: { type: Boolean, default: false },
    // Case-level aggregate analysis.
    summary: {
      text: { type: String, default: '' },
      keyPoints: [{ type: String }],
    },
    timeline: [timelineItemSchema],
    entities: [entitySchema],
    laws: [lawSchema],
    // Per-document breakdown (each item carries its own documentId).
    documents: [documentAnalysisSchema],
    error: { type: String, default: '' },
    generatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const CaseAnalysis = mongoose.model('CaseAnalysis', caseAnalysisSchema);

module.exports = CaseAnalysis;
module.exports.ANALYSIS_STATUSES = ANALYSIS_STATUSES;
