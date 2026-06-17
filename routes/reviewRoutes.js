const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/reviewController');
const { requireAuth } = require('../middlewares/auth');
const { reviewLimiter } = require('../middlewares/rateLimits');

router.use(requireAuth);
router.post('/products/:productId', reviewLimiter, asyncHandler(controller.upsertReview));
router.post('/:id/delete', reviewLimiter, asyncHandler(controller.deleteReview));

module.exports = router;
