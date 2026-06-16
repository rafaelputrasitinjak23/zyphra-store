const downloadService = require('../services/downloadService');
async function token(req, res) { const value = await downloadService.createDownloadToken({ userId: req.user._id, orderId: req.params.orderId, productId: req.params.productId }); res.redirect(`/downloads/file?token=${encodeURIComponent(value)}`); }
async function file(req, res) {
  const result = await downloadService.consumeAndGetFile({ token: req.query.token, req, currentUserId: req.user._id });
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.fileName.replace(/["\r\n]/g, '')}"`);
  if (result.contentLength) res.setHeader('Content-Length', result.contentLength);
  result.stream.on('error', (error) => res.destroy(error));
  result.stream.pipe(res);
}
module.exports = { token, file };
