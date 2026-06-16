const jwt = require('jsonwebtoken');
const axios = require('axios');
const Order = require('../models/Order');
const Product = require('../models/Product');
const DownloadLog = require('../models/DownloadLog');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const { assertSafeExternalUrl } = require('../utils/urlSafety');

function authorizeOrderItem(order, userId, productId) {
  if (!order || String(order.user) !== String(userId) || order.paymentStatus !== 'paid' || !order.accessGranted) return null;
  return order.items.find((item) => String(item.product) === String(productId)) || null;
}
async function createDownloadToken({ userId, orderId, productId }) {
  const order = await Order.findById(orderId);
  const item = authorizeOrderItem(order, userId, productId);
  if (!item) throw new AppError('Anda tidak memiliki akses ke file ini.', 403, 'DOWNLOAD_FORBIDDEN');
  if (item.downloadsUsed >= item.downloadLimit) throw new AppError('Batas download telah tercapai.', 429, 'DOWNLOAD_LIMIT');
  return jwt.sign({ sub: String(userId), orderId: String(orderId), productId: String(productId), type: 'download' }, env.downloadTokenSecret, { expiresIn: env.downloadTokenTtl, issuer: 'zyphra-store' });
}
async function consumeAndGetFile({ token, req, currentUserId }) {
  let payload;
  try { payload = jwt.verify(token, env.downloadTokenSecret, { issuer: 'zyphra-store' }); }
  catch { throw new AppError('Token download tidak valid atau kedaluwarsa.', 401, 'DOWNLOAD_TOKEN_INVALID'); }
  if (String(payload.sub) !== String(currentUserId)) throw new AppError('Token download bukan milik sesi ini.', 403, 'DOWNLOAD_SESSION_MISMATCH');
  const order = await Order.findById(payload.orderId);
  const item = authorizeOrderItem(order, payload.sub, payload.productId);
  if (!item) throw new AppError('Akses download ditolak.', 403, 'DOWNLOAD_FORBIDDEN');
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, user: payload.sub, paymentStatus: 'paid', items: { $elemMatch: { product: payload.productId, downloadsUsed: { $lt: item.downloadLimit } } } },
    { $inc: { 'items.$[target].downloadsUsed': 1 } },
    { new: true, arrayFilters: [{ 'target.product': payload.productId, 'target.downloadsUsed': { $lt: item.downloadLimit } }] }
  );
  if (!updated) throw new AppError('Batas download telah tercapai.', 429, 'DOWNLOAD_LIMIT');
  const product = await Product.findById(payload.productId).select('+digitalFileUrl');
  if (!product?.digitalFileUrl) throw new AppError('File produk tidak tersedia.', 404, 'FILE_NOT_FOUND');
  await DownloadLog.create({ user: payload.sub, order: order._id, product: product._id, ip: req.ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 500), success: true });
  const safeUrl = assertSafeExternalUrl(product.digitalFileUrl);
  const response = await axios.get(safeUrl, { responseType: 'stream', timeout: 30000, maxRedirects: 3 });
  return { stream: response.data, contentType: response.headers['content-type'] || 'application/octet-stream', contentLength: response.headers['content-length'], fileName: product.fileName || `${product.slug}.zip` };
}
module.exports = { authorizeOrderItem, createDownloadToken, consumeAndGetFile };
