const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const env = require('./env');
const ApiError = require('../utils/ApiError');

// Allowed document formats for Module 4 uploads, keyed by file extension.
// The filter cross-checks the MIME type the client declared against the
// file's actual extension — a ".txt" claiming to be "application/pdf" is
// rejected, and an extension with no known mapping (.exe, .js, .html, ...)
// is rejected outright. PDF, PNG, JPG/JPEG, DOCX, TXT per the module spec.
const ALLOWED_TYPES = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  txt: ['text/plain'],
};

// The declared MIME type is treated as authoritative unless the client had
// no useful type to declare — browsers/clients often send
// application/octet-stream (or nothing) for file inputs, in which case the
// (allowed) extension is enough to accept. Anything else mismatched is
// rejected rather than silently accepted.
const INDETERMINATE_MIME_TYPES = ['application/octet-stream', ''];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file
const MAX_FILES_PER_REQUEST = 10;

function extOf(filename) {
  return path.extname(filename || '').toLowerCase().replace(/^\./, '');
}

function isAllowed(file) {
  const ext = extOf(file.originalname);
  const allowedForExt = ALLOWED_TYPES[ext];
  if (!allowedForExt) return false;
  return allowedForExt.includes(file.mimetype) || INDETERMINATE_MIME_TYPES.includes(file.mimetype);
}

const storage = multer.diskStorage({
  // Runs after loadCase (see documentRoutes.js), so req.case._id is set and
  // files land in uploads/<caseId>/ — the directory is created on demand.
  destination(req, _file, cb) {
    const dir = path.join(env.uploadsDir, String(req.case._id));
    try {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  // Server-generated random name (keeps the real extension so future OCR /
  // content sniffing works). Never the user's originalName, so no user
  // string ever reaches the filesystem.
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (isAllowed(file)) return cb(null, true);
  cb(
    ApiError.badRequest(
      `Unsupported file type: "${file.originalname}" (${file.mimetype}). Allowed formats: PDF, PNG, JPG/JPEG, DOCX, TXT.`
    )
  );
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_REQUEST },
});

module.exports = { upload, MAX_FILE_SIZE, MAX_FILES_PER_REQUEST, ALLOWED_TYPES };
