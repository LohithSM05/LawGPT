const path = require('path');
const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Document = require('../models/Document');
const env = require('../config/env');
const { logCaseEvent } = require('../services/caseEventService');

const MAX_DOC_TYPE_LENGTH = 100;

/** Best-effort removal of a file multer already wrote, when the matching
 * Document insert fails — never leave an orphaned file behind. */
async function removeUploadedFile(file) {
  try {
    await fs.promises.unlink(file.path);
  } catch (_err) {
    // File already gone or unremovable — nothing else to do.
  }
}

// POST /api/cases/:caseId/documents
// multipart/form-data; field name "documents", up to MAX_FILES_PER_REQUEST
// files per request. Optional "docType" text field applies to all files in
// the request. multer (upload.array) runs before this handler, so files are
// already on disk and validated; each becomes one Document with status
// 'pending' — OCR/chunking/embeddings land in Phase 2.
const uploadDocuments = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('No files were uploaded. Send files under the "documents" field.');
  }

  const docType = String(req.body.docType || '').trim().slice(0, MAX_DOC_TYPE_LENGTH);

  const documents = [];
  for (const file of req.files) {
    try {
      const document = await Document.create({
        caseId: req.case._id,
        createdBy: req.user._id,
        originalName: file.originalname,
        storagePath: `${req.case._id}/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        docType,
        status: 'pending',
        chunkCount: 0,
      });
      documents.push(document);

      await logCaseEvent({
        caseId: req.case._id,
        eventType: 'DOCUMENT_UPLOADED',
        title: `Document uploaded: ${document.originalName}`,
        description: docType,
        createdBy: req.user._id,
        metadata: { documentId: document._id.toString(), fileName: document.originalName, size: document.size },
      });
    } catch (err) {
      await removeUploadedFile(file);
      throw err;
    }
  }

  return new ApiResponse(201, 'Documents uploaded', { documents, count: documents.length }).send(res);
});

// GET /api/cases/:caseId/documents
// Excludes soft-deleted documents — see deleteDocument below.
const listDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find({ caseId: req.case._id, isDeleted: { $ne: true } }).sort('-createdAt');
  return new ApiResponse(200, 'Documents retrieved', { documents }).send(res);
});

// GET /api/cases/:caseId/documents/:documentId
// Unlike Hearings (where getHearing deliberately returns soft-deleted
// records so previousHearingId links / Timeline entries still resolve),
// nothing in the app links to a deleted document, and download must reject
// it anyway — so a deleted document is simply not-found here.
const getDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.documentId,
    caseId: req.case._id,
    isDeleted: { $ne: true },
  });
  if (!document) throw ApiError.notFound('Document not found');
  return new ApiResponse(200, 'Document retrieved', { document }).send(res);
});

// DELETE /api/cases/:caseId/documents/:documentId
// Soft delete — sets isDeleted/deletedAt instead of removing the document
// (a document is case history). The physical file stays on disk for now;
// permanent file removal is deferred to a later phase / cleanup job so a
// potential future restore flow has something to recover.
const deleteDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.documentId,
    caseId: req.case._id,
    isDeleted: { $ne: true },
  });
  if (!document) throw ApiError.notFound('Document not found');

  document.isDeleted = true;
  document.deletedAt = new Date();
  await document.save();

  await logCaseEvent({
    caseId: req.case._id,
    eventType: 'DOCUMENT_DELETED',
    title: `Document deleted: ${document.originalName}`,
    createdBy: req.user._id,
    metadata: { documentId: document._id.toString(), fileName: document.originalName },
  });

  return new ApiResponse(200, 'Document deleted').send(res);
});

// GET /api/cases/:caseId/documents/:documentId/download
// Streams the stored file back as an attachment. The document must be
// non-deleted and the resolved path must stay inside the uploads root
// (defense-in-depth — storagePath is server-generated, but the bounds check
// guarantees no filesystem escape even if a stale record were ever crafted).
const downloadDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.documentId,
    caseId: req.case._id,
    isDeleted: { $ne: true },
  }).select('+storagePath');
  if (!document) throw ApiError.notFound('Document not found');

  const uploadsRoot = path.resolve(env.uploadsDir);
  const filePath = path.resolve(uploadsRoot, document.storagePath);
  if (!filePath.startsWith(uploadsRoot + path.sep)) {
    throw ApiError.badRequest('Invalid document storage path');
  }

  const exists = await fs.promises
    .access(filePath)
    .then(() => true)
    .catch(() => false);
  if (!exists) throw ApiError.notFound('Document file not found on disk');

  res.download(filePath, document.originalName);
});

module.exports = { uploadDocuments, listDocuments, getDocument, deleteDocument, downloadDocument };
