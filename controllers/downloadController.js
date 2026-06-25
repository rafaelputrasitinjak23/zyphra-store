const downloadService = require('../services/downloadService');

async function token(req, res) {
  const value = await downloadService.createDownloadToken({
    userId: req.user._id,
    orderId: req.params.orderId,
    productId: req.params.productId
  });
  res.redirect(`/downloads/file?token=${encodeURIComponent(value)}`);
}

async function file(req, res) {
  const result = await downloadService.consumeAndGetFile({ token: req.query.token, req, currentUserId: req.user._id });
  if (result.redirectUrl) return res.redirect(302, result.redirectUrl);

  const safeFileName = result.fileName.replace(/["\r\n]/g, '');
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  if (result.contentLength) res.setHeader('Content-Length', result.contentLength);

  let streamFailed = false;
  result.stream.on('error', async (error) => {
    streamFailed = true;
    await result.finalize(false, error.message);
    if (!res.headersSent) res.status(502).end();
    else res.destroy(error);
  });
  res.on('finish', () => result.finalize(!streamFailed, streamFailed ? 'stream_failed' : 'completed'));
  res.on('close', () => {
    if (!res.writableFinished) result.finalize(false, 'client_disconnected');
  });
  result.stream.pipe(res);
}

module.exports = { token, file };
