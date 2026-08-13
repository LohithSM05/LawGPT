const path = require('path');
const fs = require('fs');
const axios = require('axios');
const env = require('../config/env');
const logger = require('../utils/logger');
const Document = require('../models/Document');
const DocumentPage = require('../models/DocumentPage');
const { logCaseEvent } = require('./caseEventService');

/**
 * Module 4 Phase 2 — document processing pipeline worker.
 *
 * MongoDB stays the authoritative metadata store; python-ai is stateless per
 * request (it never touches MongoDB or the uploads filesystem). This service
 * owns the orchestration:
 *
 *   poll → atomically claim 'pending' → 'processing'
 *        → stream the uploaded file to python-ai /documents/process
 *        → persist ordered page-level text units (DocumentPage)
 *        → set status 'completed' (or 'failed' + error)
 *        → emit DOCUMENT_PROCESSING_* CaseEvents
 *
 * The worker is an in-process, MongoDB-polled loop (no Redis/BullMQ — this is
 * a single-instance project). A document stuck in 'processing' past
 * env.docPipeline.processingTimeoutMs is treated as a crashed job and
 * requeued to 'pending'. python-ai being unreachable is NOT a document
 * failure — the doc goes back to 'pending' and retries next tick.
 */

const PYTHON_PROCESS_TIMEOUT_MS = 30 * 60 * 1000; // hard cap on one document call

let pollTimer = null;
let tickInFlight = false;

/** Is this a network-level failure (python-ai unreachable) rather than a
 * pipeline/HTTP error response? Only these are requeued, not failed. */
function isConnectionError(err) {
  if (err.response) return false; // python-ai answered (even with an error status)
  return Boolean(err.request || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT');
}

/** Best-effort human-readable error from a failed python-ai call. FastAPI
 * validation failures put an array of objects in `detail`, so never rely on
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

/** Requeues documents left in 'processing' by a crashed run — idempotent. */
async function recoverStuckProcessing() {
  const cutoff = new Date(Date.now() - env.docPipeline.processingTimeoutMs);
  const { modifiedCount } = await Document.updateMany(
    { status: 'processing', updatedAt: { $lt: cutoff } },
    { $set: { status: 'pending', error: '' } }
  );
  if (modifiedCount > 0) logger.warn(`Requeued ${modifiedCount} stuck document(s) to pending`);
}

/** Pushes one uploaded document through the python-ai pipeline and persists
 * the result into MongoDB. The claim (pending → processing) is atomic so two
 * ticks (or restarts) can never process the same document twice. */
async function processDocument(document) {
  const claimed = await Document.findOneAndUpdate(
    { _id: document._id, status: 'pending', isDeleted: { $ne: true } },
    { $set: { status: 'processing', error: '', processedAt: null } },
    { new: true }
  ).select('+storagePath');
  if (!claimed) return;

  await logCaseEvent({
    caseId: claimed.caseId,
    eventType: 'DOCUMENT_PROCESSING_STARTED',
    title: `Processing document: ${claimed.originalName}`,
    createdBy: claimed.createdBy,
    metadata: { documentId: claimed._id.toString() },
  });

  try {
    const filePath = path.resolve(env.uploadsDir, claimed.storagePath);
    const resolvedRoot = path.resolve(env.uploadsDir);
    if (!filePath.startsWith(resolvedRoot + path.sep)) {
      throw new Error('Invalid document storage path');
    }
    if (!fs.existsSync(filePath)) {
      throw new Error('Document file not found on disk');
    }

    const buffer = await fs.promises.readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([buffer]), path.basename(claimed.storagePath));
    // FastAPI routes use snake_case parameter names for form fields.
    form.append('document_id', claimed._id.toString());
    form.append('case_id', claimed.caseId.toString());
    form.append('doc_type', claimed.docType || '');
    form.append('original_name', claimed.originalName || '');
    form.append('mime_type', claimed.mimeType || '');
    form.append('language', 'en');

    const response = await axios.post(`${env.pythonAiServiceUrl}/documents/process`, form, {
      headers: form.getHeaders ? form.getHeaders() : undefined,
      timeout: PYTHON_PROCESS_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const result = response.data?.data ?? response.data;
    const pages = Array.isArray(result?.pages) ? result.pages : [];

    // Replace the document's page units wholesale (idempotent reprocess).
    await DocumentPage.deleteMany({ documentId: claimed._id });
    if (pages.length > 0) {
      await DocumentPage.insertMany(
        pages.map((p) => ({
          caseId: claimed.caseId,
          documentId: claimed._id,
          pageNumber: p.pageNumber,
          text: p.text,
          charCount: p.charCount,
        }))
      );
    }

    claimed.extractedText = pages.map((p) => p.text).join('\n\n');
    claimed.status = 'completed';
    claimed.pageCount = Number(result.pageCount) || pages.length;
    claimed.chunkCount = Number(result.chunkCount) || 0;
    claimed.processedAt = new Date();
    claimed.error = '';
    await claimed.save();

    await logCaseEvent({
      caseId: claimed.caseId,
      eventType: 'DOCUMENT_PROCESSED',
      title: `Document processed: ${claimed.originalName}`,
      createdBy: claimed.createdBy,
      metadata: {
        documentId: claimed._id.toString(),
        format: result.format || '',
        pageCount: claimed.pageCount,
        chunkCount: claimed.chunkCount,
      },
    });

    logger.info(`Document ${claimed._id} processed (${claimed.pageCount} pages, ${claimed.chunkCount} chunks)`);
  } catch (err) {
    if (isConnectionError(err)) {
      // python-ai is down — not the document's fault. Requeue and try again.
      claimed.status = 'pending';
      claimed.error = 'AI service unreachable — will retry';
      logger.warn(`python-ai unreachable for document ${claimed._id}, requeued: ${err.code || err.message}`);
    } else {
      claimed.status = 'failed';
      claimed.error = extractError(err);
      await logCaseEvent({
        caseId: claimed.caseId,
        eventType: 'DOCUMENT_PROCESSING_FAILED',
        title: `Document processing failed: ${claimed.originalName}`,
        description: claimed.error,
        createdBy: claimed.createdBy,
        metadata: { documentId: claimed._id.toString(), error: claimed.error },
      });
      logger.warn(`Document ${claimed._id} failed: ${claimed.error}`);
    }
    await claimed.save();
  }
}

/** One poll tick: recover crashed jobs, then process every pending document
 * sequentially (each is a full extract → embed round-trip; one at a time
 * keeps OCR/embedding memory predictable). */
async function tick() {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    await recoverStuckProcessing();
    // Loop instead of a single pick so a burst of uploads doesn't wait one
    // poll interval per document.
    let next = await Document.findOne({ status: 'pending', isDeleted: { $ne: true } }).sort('createdAt');
    while (next) {
      await processDocument(next);
      next = await Document.findOne({ status: 'pending', isDeleted: { $ne: true } }).sort('createdAt');
    }
  } catch (err) {
    logger.error(`Document pipeline tick error: ${err.stack || err.message}`);
  } finally {
    tickInFlight = false;
  }
}

/** Nudges the worker to poll immediately instead of waiting for the interval. */
function wake() {
  if (pollTimer) tick();
}

function startDocumentWorker() {
  if (pollTimer) return;
  logger.info(
    `Document pipeline worker started (poll ${env.docPipeline.pollIntervalMs}ms, processing timeout ${env.docPipeline.processingTimeoutMs}ms)`
  );
  // First tick shortly after boot (handles crash recovery + anything left
  // pending from a previous run), then on the poll interval.
  tick();
  pollTimer = setInterval(tick, env.docPipeline.pollIntervalMs);
  if (pollTimer.unref) pollTimer.unref();
}

function stopDocumentWorker() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = { startDocumentWorker, stopDocumentWorker, wake, processDocument, tick };
