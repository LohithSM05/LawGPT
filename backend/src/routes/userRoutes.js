const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { updateProfileValidator } = require('../validators/userValidators');
const { validate } = require('../validators/authValidators');

const router = express.Router();

router.put('/profile', protect, updateProfileValidator, validate, userController.updateProfile);

module.exports = router;
