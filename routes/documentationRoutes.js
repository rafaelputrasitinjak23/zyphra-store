const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/documentationController');

router.get('/:slug', asyncHandler(controller.publicDoc));

module.exports = router;
