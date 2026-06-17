const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/walletController');
const { requireAuth } = require('../middlewares/auth');
const { checkoutLimiter, cancelLimiter } = require('../middlewares/rateLimits');

router.use(requireAuth);
router.get('/', asyncHandler(controller.dashboard));
router.get('/deposit', asyncHandler(controller.depositForm));
router.post('/deposit', checkoutLimiter, asyncHandler(controller.createDeposit));
router.get('/deposits/:depositNumber', asyncHandler(controller.depositDetail));
router.post('/deposits/:depositNumber/check', checkoutLimiter, asyncHandler(controller.checkDeposit));
router.post('/deposits/:depositNumber/cancel', cancelLimiter, asyncHandler(controller.cancelDeposit));
router.post('/redeem', checkoutLimiter, asyncHandler(controller.redeem));

module.exports = router;
