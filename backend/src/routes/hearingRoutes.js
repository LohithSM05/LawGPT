const express = require('express');
const hearingController = require('../controllers/hearingController');
const { protect } = require('../middleware/authMiddleware');
const { loadCase, requireCaseAccess } = require('../middleware/caseAccess');
const { validate } = require('../validators/authValidators');
const {
  createHearingValidator,
  updateHearingValidator,
  transitionHearingValidator,
} = require('../validators/hearingValidators');

const router = express.Router({ mergeParams: true }); // needed to read :caseId from the parent mount

router.use(protect, loadCase, requireCaseAccess);

router.post('/', createHearingValidator, validate, hearingController.createHearing);
router.get('/', hearingController.listHearings);
router.get('/:hearingId', hearingController.getHearing);
router.put('/:hearingId', updateHearingValidator, validate, hearingController.updateHearing);
router.post('/:hearingId/transition', transitionHearingValidator, validate, hearingController.transitionHearing);
router.delete('/:hearingId', hearingController.deleteHearing);

module.exports = router;
