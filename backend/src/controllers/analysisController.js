const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const CaseAnalysis = require('../models/CaseAnalysis');
const Document = require('../models/Document');
const DocumentPage = require('../models/DocumentPage');
const { buildAnalysisPayload, analyzeCase } = require('../services/analysisService');
const { logCaseEvent } = require('../services/caseEventService');

/**
 * Module 5 Phase 3 — case analysis controller.
 *
 * Synchronous lifecycle (see the plan): the request itself is the run. The
 * CaseAnalysis record moves pending → processing → completed | failed and is
 * never left in a terminal-looking partial state — a failure always lands in
 * `failed` with a readable error. The `status` field is retained so a later
 * module can convert this to a background worker without redesigning the model.
 */

// POST /api/cases/:caseId/analysis
const runAnalysis = asyncHandler(async (req, res) => {
  const caseDoc = req.case;
  const language = req.body?.language === 'kn' ? 'kn' : 'en';

  // Only documents the Module 4 pipeline finished are analyzable.
  const documents = await Document.find({
    caseId: caseDoc._id,
    isDeleted: { $ne: true },
    status: 'completed',
  });
  if (documents.length === 0) {
    throw ApiError.badRequest(
      'This case has no processed documents yet. Upload and process at least one document first.'
    );
  }

  // Authoritative page units with page provenance (DocumentPage).
  const pagesByDocument = new Map();
  const allPages = await DocumentPage.find({ caseId: caseDoc._id }).sort('pageNumber');
  for (const page of allPages) {
    const key = page.documentId.toString();
    if (!pagesByDocument.has(key)) pagesByDocument.set(key, []);
    pagesByDocument.get(key).push({ pageNumber: page.pageNumber, text: page.text, charCount: page.charCount });
  }

  // Claim the record: create-or-replace the single analysis per case and put
  // it in 'processing'. On failure this same record is flipped to 'failed',
  // so no stale 'processing' row can outlive a synchronous request.
  const analysis = await CaseAnalysis.findOneAndUpdate(
    { caseId: caseDoc._id },
    {
      $set: {
        createdBy: req.user._id,
        status: 'processing',
        requestLanguage: language,
        error: '',
        generatedAt: null,
        summary: { text: '', keyPoints: [] },
        timeline: [],
        entities: [],
        laws: [],
        documents: [],
        retrievalUsed: false,
      },
    },
    { upsert: true, new: true }
  );

  await logCaseEvent({
    caseId: caseDoc._id,
    eventType: 'AI_ANALYSIS_STARTED',
    title: 'Case analysis started',
    description: `Analyzing ${documents.length} processed document(s) (language: ${language}).`,
    createdBy: req.user._id,
    metadata: { documentCount: documents.length, language },
  });

  const payload = buildAnalysisPayload({ caseDoc, documents, pagesByDocument, language });

  let result;
  try {
    result = await analyzeCase(payload);
  } catch (err) {
    // Persist the failure so GET returns a failed analysis, never a stale
    // 'processing' row. Re-throw so the client gets the clean HTTP error.
    analysis.status = 'failed';
    analysis.error = err.message || 'Analysis failed';
    analysis.generatedAt = new Date();
    await analysis.save();

    await logCaseEvent({
      caseId: caseDoc._id,
      eventType: 'AI_ANALYSIS_FAILED',
      title: 'Case analysis failed',
      description: analysis.error,
      createdBy: req.user._id,
      metadata: { error: analysis.error },
    });

    throw err;
  }

  analysis.status = 'completed';
  analysis.summary = result.summary || { text: '', keyPoints: [] };
  analysis.timeline = result.timeline || [];
  analysis.entities = result.entities || [];
  analysis.laws = result.laws || [];
  analysis.documents = result.documents || [];
  analysis.retrievalUsed = Boolean(result.retrievalUsed);
  analysis.requestLanguage = result.language === 'kn' ? 'kn' : language;
  analysis.error = '';
  analysis.generatedAt = new Date();
  await analysis.save();

  await logCaseEvent({
    caseId: caseDoc._id,
    eventType: 'AI_ANALYSIS_COMPLETED',
    title: 'Case analysis completed',
    description: `${analysis.documents.length} document(s) analyzed: ${analysis.timeline.length} timeline event(s), ${analysis.entities.length} entity(ies), ${analysis.laws.length} law reference(s).`,
    createdBy: req.user._id,
    metadata: {
      documentCount: analysis.documents.length,
      timelineCount: analysis.timeline.length,
      entityCount: analysis.entities.length,
      lawCount: analysis.laws.length,
      retrievalUsed: analysis.retrievalUsed,
    },
  });

  return new ApiResponse(201, 'Case analysis completed', { analysis }).send(res);
});

// GET /api/cases/:caseId/analysis
// Returns the latest analysis for the case, or 404 if none has been generated.
const getAnalysis = asyncHandler(async (req, res) => {
  const analysis = await CaseAnalysis.findOne({ caseId: req.case._id });
  if (!analysis) throw ApiError.notFound('No analysis has been generated for this case yet');
  return new ApiResponse(200, 'Analysis retrieved', { analysis }).send(res);
});

module.exports = { runAnalysis, getAnalysis };
