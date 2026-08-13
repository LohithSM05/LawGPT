const express = require('express');
const documentController = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');
const { loadCase, requireCaseAccess } = require('../middleware/caseAccess');
const { upload, MAX_FILES_PER_REQUEST } = require('../config/upload');

const router = express.Router({ mergeParams: true }); // needed to read :caseId from the parent mount

// Same access-control chain as Hearings: authenticated → case loaded →
// ownership/assignment/admin check. No flat /documents route exists — a
// document only ever exists inside a case.
router.use(protect, loadCase, requireCaseAccess);

// multer runs after loadCase so the storage destination can use req.case._id.
// "documents" is the multipart field name; an optional "docType" text field
// may accompany the files.
router.post('/', upload.array('documents', MAX_FILES_PER_REQUEST), documentController.uploadDocuments);
router.get('/', documentController.listDocuments);
router.get('/:documentId', documentController.getDocument);
router.delete('/:documentId', documentController.deleteDocument);
router.get('/:documentId/download', documentController.downloadDocument);
// Phase 2: queue a document for (re)processing, and read its ordered
// page-level text units.
router.post('/:documentId/process', documentController.triggerProcess);
router.get('/:documentId/pages', documentController.getDocumentPages);

module.exports = router;
