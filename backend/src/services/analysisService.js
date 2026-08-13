const axios = require('axios');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Module 5 Phase 3 — calls python-ai's stateless analysis service.
 *
 * Ownership boundary unchanged from Module 4: MongoDB (DocumentPage) is the
 * authoritative text store, the backend assembles the case's page units from
 * it and streams them to python-ai over HTTP, and python-ai stays stateless
 * (never touches MongoDB/uploads/Chroma writes). The backend persists the
 * structured result into the CaseAnalysis collection.
 */

const ANALYSIS_CALL_TIMEOUT_MS = 10 * 60 * 1000; // hard cap on one analysis call

/** Is this a network-level failure (python-ai unreachable) rather than a
 * pipeline/HTTP error response? Connection failures surface as clean 502s. */
function isConnectionError(err) {
  if (err.response) return false; // python-ai answered (even with an error status)
  return Boolean(err.request || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT');
}

/** Best-effort human-readable error from a failed python-ai call. FastAPI
 * validation failures put an array of objects in `detail` — never rely on
 * implicit string coercion. */
function extractError(err) {
  const raw =
    err.response?.data?.error ?? err.response?.data?.detail ?? err.response?.data?.message ?? err.message;
  if (typeof raw === 'string') return raw.slice(0, 2000);
  try {
    return JSON.stringify(raw).slice(0, 2000);
  } catch (_e) {
    return String(raw).slice(0, 2000);
  }
}

/**
 * Builds the python-ai analysis request from the case's completed documents.
 * Uses the authoritative DocumentPage page units. The total text is capped at
 * env.analysis.maxChars; whole pages are dropped from the end (never cut
 * mid-page) so remaining pages keep full provenance, and the request flags
 * `truncated` so the prompt can state that later pages were excluded.
 */
function buildAnalysisPayload({ caseDoc, documents, pagesByDocument, language = 'en' }) {
  const maxChars = env.analysis.maxChars;
  const requestDocuments = [];
  let budget = maxChars;
  let truncated = false;

  for (const document of documents) {
    const pages = pagesByDocument.get(document._id.toString()) || [];
    const kept = [];
    for (const page of pages) {
      const size = page.text.length;
      if (budget <= 0) {
        truncated = true;
        break;
      }
      if (size > budget) {
        truncated = true;
        break; // skip this whole page rather than cutting mid-page
      }
      kept.push({ pageNumber: page.pageNumber, text: page.text, charCount: page.text.length });
      budget -= size;
    }
    if (pages.length > kept.length) truncated = true;

    requestDocuments.push({
      documentId: document._id.toString(),
      documentName: document.originalName,
      docType: document.docType || '',
      pages: kept,
    });
  }

  return {
    caseId: caseDoc._id.toString(),
    language,
    truncated,
    documents: requestDocuments,
  };
}

/** Calls python-ai POST /analysis/case and returns the structured result.
 * Throws ApiError(502) when python-ai is unreachable and ApiError(422) with
 * the service's detail on a pipeline/validation failure. */
async function analyzeCase(payload) {
  let response;
  try {
    response = await axios.post(`${env.pythonAiServiceUrl}/analysis/case`, payload, {
      timeout: ANALYSIS_CALL_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } catch (err) {
    if (isConnectionError(err)) {
      logger.warn(`python-ai unreachable for analysis (case ${payload.caseId}): ${err.code || err.message}`);
      throw ApiError.badGateway('AI service unreachable — analysis failed');
    }
    const detail = extractError(err);
    logger.warn(`Analysis failed (case ${payload.caseId}): ${detail}`);
    throw ApiError.unprocessable(detail || 'Analysis failed');
  }

  const data = response.data?.data ?? response.data;
  if (!data || typeof data !== 'object' || data.status === 'failed') {
    const detail = data?.error || 'Analysis returned an empty result';
    throw ApiError.unprocessable(detail);
  }
  return data;
}

module.exports = { buildAnalysisPayload, analyzeCase, ANALYSIS_CALL_TIMEOUT_MS };
