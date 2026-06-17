const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/aiController');
const { aiLimiter } = require('../middlewares/rateLimits');
router.post('/chat', aiLimiter, asyncHandler(controller.chat));
module.exports = router;
