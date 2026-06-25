const crypto = require('crypto');
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

let client;

function enabled() {
  return Boolean(env.objectStorage.enabled);
}

function getClient() {
  if (!enabled()) throw new AppError('Object storage belum diaktifkan.', 503, 'OBJECT_STORAGE_DISABLED');
  if (!client) {
    client = new S3Client({
      region: env.objectStorage.region,
      endpoint: env.objectStorage.endpoint || undefined,
      forcePathStyle: env.objectStorage.forcePathStyle,
      credentials: {
        accessKeyId: env.objectStorage.accessKeyId,
        secretAccessKey: env.objectStorage.secretAccessKey
      }
    });
  }
  return client;
}

function normalizeObjectKey(value, { prefix = '' } = {}) {
  const raw = String(value || '').trim().replace(/^s3:\/\/[^/]+\//i, '').replace(/^\/+/, '');
  if (!raw || raw.length > 1024 || raw.includes('\\') || raw.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new AppError('Object key storage tidak valid.', 400, 'INVALID_STORAGE_KEY');
  }
  if (/[^A-Za-z0-9!_.*'()\-/]/.test(raw)) throw new AppError('Object key storage mengandung karakter yang tidak didukung.', 400, 'INVALID_STORAGE_KEY');
  if (prefix && !raw.startsWith(`${prefix}/`)) return `${prefix}/${raw}`;
  return raw;
}

function publicUrlForKey(key) {
  if (!env.objectStorage.publicBaseUrl) return '';
  const normalized = normalizeObjectKey(key);
  return `${env.objectStorage.publicBaseUrl}/${normalized.split('/').map(encodeURIComponent).join('/')}`;
}

async function getObjectStream(key) {
  const normalized = normalizeObjectKey(key);
  const response = await getClient().send(new GetObjectCommand({ Bucket: env.objectStorage.bucket, Key: normalized }));
  if (!response.Body) throw new AppError('Object file tidak memiliki isi.', 502, 'OBJECT_STORAGE_EMPTY_BODY');
  return {
    stream: response.Body,
    contentType: response.ContentType || 'application/octet-stream',
    contentLength: response.ContentLength ? String(response.ContentLength) : undefined,
    etag: response.ETag
  };
}

async function createSignedDownloadUrl(key, options = {}) {
  const normalized = normalizeObjectKey(key);
  const command = new GetObjectCommand({
    Bucket: env.objectStorage.bucket,
    Key: normalized,
    ResponseContentDisposition: options.fileName
      ? `attachment; filename="${String(options.fileName).replace(/["\r\n]/g, '')}"`
      : undefined
  });
  return getSignedUrl(getClient(), command, {
    expiresIn: options.expiresIn || env.objectStorage.signedUrlTtlSeconds
  });
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new AppError('Data gambar tidak valid.', 400, 'INVALID_IMAGE_DATA');
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

async function uploadAvatar({ userId, dataUrl }) {
  if (!enabled() || !env.objectStorage.publicBaseUrl) return null;
  const { contentType, buffer } = decodeDataUrl(dataUrl);
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
  const digest = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 20);
  const key = normalizeObjectKey(`${userId}/${Date.now()}-${digest}.${extension}`, { prefix: env.objectStorage.avatarPrefix });
  await getClient().send(new PutObjectCommand({
    Bucket: env.objectStorage.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable'
  }));
  return { key, url: publicUrlForKey(key) };
}

async function deleteObject(key) {
  if (!enabled() || !key) return false;
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: env.objectStorage.bucket, Key: normalizeObjectKey(key) }));
    return true;
  } catch (error) {
    logger.warn('object_storage.delete_failed', { key, error });
    return false;
  }
}

function productObjectKey(value) {
  return normalizeObjectKey(value, { prefix: env.objectStorage.productPrefix });
}

module.exports = {
  enabled,
  normalizeObjectKey,
  publicUrlForKey,
  createSignedDownloadUrl,
  getObjectStream,
  uploadAvatar,
  deleteObject,
  productObjectKey
};
