const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/adminController');
const supportPopupController = require('../controllers/supportPopupController');
const aiController = require('../controllers/aiController');
let supportController = null; try { supportController = require('../controllers/supportController'); } catch (_) {}
let documentationController = null; try { documentationController = require('../controllers/documentationController'); } catch (_) {}
const { requireAdmin } = require('../middlewares/auth');
const { aiLimiter, cancelLimiter } = require('../middlewares/rateLimits');

router.use(requireAdmin);
router.get('/', asyncHandler(controller.dashboard));
router.get('/products', asyncHandler(controller.products));
router.get('/products/new', asyncHandler(controller.newProduct));
router.post('/products', asyncHandler(controller.createProduct));
router.get('/products/:id/edit', asyncHandler(controller.editProduct));
router.post('/products/:id', asyncHandler(controller.updateProduct));
router.post('/products/:id/toggle', asyncHandler(controller.toggleProduct));
router.get('/discounts', asyncHandler(controller.discounts));
router.get('/discounts/new', asyncHandler(controller.newDiscount));
router.post('/discounts', asyncHandler(controller.createDiscount));
router.get('/discounts/:id/edit', asyncHandler(controller.editDiscount));
router.post('/discounts/:id', asyncHandler(controller.updateDiscount));
router.post('/discounts/:id/toggle', asyncHandler(controller.toggleDiscount));
router.post('/ai/product-copy', aiLimiter, asyncHandler(aiController.generateProductCopy));
router.get('/categories', asyncHandler(controller.categories));
router.post('/categories', asyncHandler(controller.createCategory));
router.post('/categories/:id', asyncHandler(controller.updateCategory));
router.get('/users', asyncHandler(controller.users));
router.get('/wallets', asyncHandler(controller.wallets));
router.post('/wallets/:userId/adjust', asyncHandler(controller.adjustWallet));
router.post('/wallets/:userId/status', asyncHandler(controller.updateWalletStatus));
router.post('/users/:id', asyncHandler(controller.updateUser));
if (typeof controller.reviews === 'function' && typeof controller.toggleReview === 'function') {
  router.get('/reviews', asyncHandler(controller.reviews));
  router.post('/reviews/:id/toggle', asyncHandler(controller.toggleReview));
}
if (supportController) {
router.get('/support', asyncHandler(supportController.adminList));
router.get('/support/:ticketNumber', asyncHandler(supportController.adminDetail));
router.post('/support/:ticketNumber/reply', asyncHandler(supportController.adminReply));
router.post('/support/:ticketNumber/close', asyncHandler(supportController.adminClose));
}
if (documentationController) {
router.get('/documentation', asyncHandler(documentationController.adminIndex));
router.get('/documentation/:productId', asyncHandler(documentationController.adminEdit));
router.post('/documentation/:productId', asyncHandler(documentationController.adminUpdate));
}
router.get('/orders', asyncHandler(controller.orders));
router.get('/orders/:orderNumber', asyncHandler(controller.orderDetail));
router.post('/orders/:orderNumber/recheck', asyncHandler(controller.recheckOrder));
router.post('/orders/:orderNumber/cancel', cancelLimiter, asyncHandler(controller.cancelOrder));
router.post('/orders/:orderNumber/resend-invoice', asyncHandler(controller.resendInvoice));
router.get('/support-popup', asyncHandler(supportPopupController.edit));
router.post('/support-popup', asyncHandler(supportPopupController.update));
router.get('/settings', asyncHandler(controller.settings));
router.post('/settings', asyncHandler(controller.updateSettings));
router.get('/logs/webhooks', asyncHandler(controller.webhookLogs));
router.get('/logs/emails', asyncHandler(controller.emailLogs));
router.get('/logs/audit', asyncHandler(controller.auditLogs));
router.post('/logs/emails/:id/retry', asyncHandler(controller.retryEmail));

module.exports = router;
