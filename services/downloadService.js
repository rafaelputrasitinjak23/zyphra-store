const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const Product = require('../models/Product');
const DownloadLog = require('../models/DownloadLog');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const { assertSafeExternalUrl, openSafeExternalStream, resolveSafeExternalUrl } = require('../utils/urlSafety');
const objectStorageService = require('./objectStorageService');

function authorizeOrderItem(order, userId, productId) {
  if (!order || String(order.user) !== String(userId) || order.paymentStatus !== 'paid' || !order.accessGranted) return null;
  return order.items.find((item) => String(item.product) === String(productId)) || null;
}

async function createDownloadToken({ userId, orderId, productId }) {
  const order = await Order.findById(orderId);
  const item = authorizeOrderItem(order, userId, productId);
  if (!item) throw new AppError('Anda tidak memiliki akses ke file ini.', 403, 'DOWNLOAD_FORBIDDEN');
  if (item.downloadsUsed >= item.downloadLimit) throw new AppError('Batas download telah tercapai.', 429, 'DOWNLOAD_LIMIT');
  return jwt.sign(
    { sub: String(userId), orderId: String(orderId), productId: String(productId), type: 'download' },
    env.downloadTokenSecret,
    { expiresIn: env.downloadTokenTtl, issuer: 'zyphra-store', audience: 'product-download' }
  );
}

async function reserveDownloadQuota({ order, productId, userId, limit }) {
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      user: userId,
      paymentStatus: 'paid',
      accessGranted: true,
      items: { $elemMatch: { product: productId, downloadsUsed: { $lt: limit } } }
    },
    { $inc: { 'items.$[target].downloadsUsed': 1 } },
    { new: true, arrayFilters: [{ 'target.product': productId, 'target.downloadsUsed': { $lt: limit } }] }
  );
  if (!updated) throw new AppError('Batas download telah tercapai.', 429, 'DOWNLOAD_LIMIT');
  return updated;
}

async function rollbackDownloadQuota({ orderId, productId, userId }) {
  await Order.updateOne(
    { _id: orderId, user: userId, items: { $elemMatch: { product: productId, downloadsUsed: { $gt: 0 } } } },
    { $inc: { 'items.$[target].downloadsUsed': -1 } },
    { arrayFilters: [{ 'target.product': productId, 'target.downloadsUsed': { $gt: 0 } }] }
  );
}

async function consumeAndGetFile({ token, req, currentUserId }) {
  let payload;
  try {
    payload = jwt.verify(token, env.downloadTokenSecret, { issuer: 'zyphra-store', audience: 'product-download' });
  } catch {
    throw new AppError('Token download tidak valid atau kedaluwarsa.', 401, 'DOWNLOAD_TOKEN_INVALID');
  }
  if (payload.type !== 'download' || String(payload.sub) !== String(currentUserId)) {
    throw new AppError('Token download bukan milik sesi ini.', 403, 'DOWNLOAD_SESSION_MISMATCH');
  }

  const order = await Order.findById(payload.orderId);
  const item = authorizeOrderItem(order, payload.sub, payload.productId);
  if (!item) throw new AppError('Akses download ditolak.', 403, 'DOWNLOAD_FORBIDDEN');
  if (item.downloadsUsed >= item.downloadLimit) throw new AppError('Batas download telah tercapai.', 429, 'DOWNLOAD_LIMIT');

  const product = await Product.findById(payload.productId).select('+digitalFileUrl +digitalStorageKey');
  if (!product?.digitalFileUrl && !product?.digitalStorageKey) throw new AppError('File produk tidak tersedia.', 404, 'FILE_NOT_FOUND');
  const fileName = product.fileName || `${product.slug}.zip`;

  let upstream = null;
  let redirectUrl = '';
  if (product.digitalStorageKey) {
    if (env.downloadDeliveryMode === 'redirect') {
      redirectUrl = await objectStorageService.createSignedDownloadUrl(product.digitalStorageKey, { fileName });
      await resolveSafeExternalUrl(redirectUrl);
    } else {
      const object = await objectStorageService.getObjectStream(product.digitalStorageKey);
      upstream = { response: { data: object.stream, headers: { 'content-type': object.contentType, 'content-length': object.contentLength } } };
    }
  } else {
    const safeUrl = assertSafeExternalUrl(product.digitalFileUrl);
    // URL legacy selalu diproxy agar URL permanen tidak terekspos kepada pengguna.
    upstream = await openSafeExternalStream(safeUrl);
  }

  try {
    await reserveDownloadQuota({ order, productId: payload.productId, userId: payload.sub, limit: item.downloadLimit });
  } catch (error) {
    upstream?.response?.data?.destroy?.();
    throw error;
  }

  const log = await DownloadLog.create({
    user: payload.sub,
    order: order._id,
    product: product._id,
    ip: req.ip,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
    success: false,
    reason: 'started'
  });

  if (redirectUrl) {
    log.success = true;
    log.reason = 'redirected_to_signed_storage_url';
    await log.save();
    return { redirectUrl, fileName };
  }

  let finalized = false;
  const finalize = async (success, reason = '') => {
    if (finalized) return;
    finalized = true;
    if (!success) {
      await rollbackDownloadQuota({ orderId: order._id, productId: product._id, userId: payload.sub }).catch(() => {});
    }
    await DownloadLog.updateOne(
      { _id: log._id },
      { $set: { success, reason: String(reason || (success ? 'completed' : 'stream_failed')).slice(0, 500) } }
    ).catch(() => {});
  };

  return {
    stream: upstream.response.data,
    contentType: upstream.response.headers['content-type'] || 'application/octet-stream',
    contentLength: upstream.response.headers['content-length'],
    fileName,
    finalize
  };
}

module.exports = { authorizeOrderItem, createDownloadToken, consumeAndGetFile, reserveDownloadQuota, rollbackDownloadQuota };
