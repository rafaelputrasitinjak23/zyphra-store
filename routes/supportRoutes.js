const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/supportController');
const { requireAuth } = require('../middlewares/auth');

router.use(requireAuth);
router.get('/', asyncHandler(controller.list));
router.get('/new', asyncHandler(controller.newForm));
router.post('/', asyncHandler(controller.create));
router.get('/:ticketNumber', asyncHandler(controller.detail));
router.post('/:ticketNumber/reply', asyncHandler(controller.reply));
router.post('/:ticketNumber/close', asyncHandler(controller.close));

module.exports = router;
