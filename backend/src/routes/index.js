const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const caseRoutes = require('./caseRoutes');
const hearingRoutes = require('./hearingRoutes');
const documentRoutes = require('./documentRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
// Mount the nested sub-resource routers before '/cases' — both are valid,
// non-overlapping paths, but keeping the more specific ones first avoids
// any ambiguity as more sub-resources get added under /cases later.
router.use('/cases/:caseId/documents', documentRoutes);
router.use('/cases/:caseId/hearings', hearingRoutes);
router.use('/cases', caseRoutes);

module.exports = router;
