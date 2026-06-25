const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/systemController');
const { maintenanceLimiter } = require('../middlewares/rateLimits');
router.get('/ready', controller.readiness);
router.get('/maintenance', maintenanceLimiter, asyncHandler(controller.maintenance));
router.post('/maintenance', maintenanceLimiter, asyncHandler(controller.maintenance));
module.exports = router;
