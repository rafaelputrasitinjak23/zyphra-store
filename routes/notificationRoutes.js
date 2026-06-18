const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/notificationController');
const { requireAuth } = require('../middlewares/auth');

router.use(requireAuth);
router.get('/', asyncHandler(controller.list));
router.post('/read-all', asyncHandler(controller.markAll));
router.post('/:id/read', asyncHandler(controller.markRead));

module.exports = router;
