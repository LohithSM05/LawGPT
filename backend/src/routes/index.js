const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const caseRoutes = require('./caseRoutes');
const hearingRoutes = require('./hearingRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
// Mount the nested hearings router before '/cases' — both are valid,
// non-overlapping paths, but keeping the more specific one first avoids
// any ambiguity as more sub-resources get added under /cases later.
router.use('/cases/:caseId/hearings', hearingRoutes);
router.use('/cases', caseRoutes);

// Later modules mount here, e.g.:
// router.use('/documents', documentRoutes);

module.exports = router;
