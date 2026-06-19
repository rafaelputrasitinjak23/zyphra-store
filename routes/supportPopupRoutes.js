const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/supportPopupController');
router.get('/', asyncHandler(controller.publicConfig));
module.exports = router;
