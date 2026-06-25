const axios = require('axios');
const crypto = require('crypto');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const { normalizeAuthoritativeFee } = require('./feeService');

function ensureConfig() {
  if (!env.pakasir.enabled || !env.pakasir.slug || !env.pakasir.apiKey) throw new AppError('Pakasir belum dikonfigurasi.', 503, 'PAKASIR_NOT_CONFIGURED');
}
function client() { return axios.create({ baseURL: env.pakasir.baseUrl, timeout: 20000, headers: { 'Content-Type': 'application/json' } }); }
async function createTransaction({ method, orderId, amount }) {
  ensureConfig();
  const payload = { project: env.pakasir.slug, order_id: orderId, amount, api_key: env.pakasir.apiKey };
  try {
    const { data } = await client().post(`/api/transactioncreate/${encodeURIComponent(method)}`, payload);
    if (!data?.payment) throw new Error('Respons payment kosong.');
    return { payment: data.payment, safeRequest: { project: env.pakasir.slug, order_id: orderId, amount, method }, raw: data };
  } catch (error) {
    throw new AppError(error.response?.data?.message || error.message || 'Gagal membuat transaksi Pakasir.', 502, 'PAKASIR_CREATE_FAILED');
  }
}
async function cancelTransaction({ orderId, amount }) {
  ensureConfig();
  try {
    const { data } = await client().post('/api/transactioncancel', { project: env.pakasir.slug, order_id: orderId, amount, api_key: env.pakasir.apiKey });
    return data || { cancelled: true };
  } catch (error) {
    throw new AppError(error.response?.data?.message || error.message || 'Gagal membatalkan transaksi Pakasir.', 502, 'PAKASIR_CANCEL_FAILED');
  }
}
async function getTransactionDetail({ orderId, amount }) {
  ensureConfig();
  try {
    const { data } = await client().get('/api/transactiondetail', { params: { project: env.pakasir.slug, amount, order_id: orderId, api_key: env.pakasir.apiKey } });
    if (!data?.transaction) throw new Error('Detail transaksi kosong.');
    return data.transaction;
  } catch (error) {
    throw new AppError(error.response?.data?.message || error.message || 'Gagal mengecek transaksi Pakasir.', 502, 'PAKASIR_DETAIL_FAILED');
  }
}
async function simulatePayment({ orderId, amount }) {
  ensureConfig();
  const { data } = await client().post('/api/paymentsimulation', { project: env.pakasir.slug, order_id: orderId, amount, api_key: env.pakasir.apiKey });
  return data;
}
async function createReconciledTransaction({ method, orderId, subtotal, threshold, initialAmount }) {
  let amount = initialAmount;
  let last;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    last = await createTransaction({ method, orderId, amount });
    const split = normalizeAuthoritativeFee(subtotal, threshold, last.payment);
    if (split.isBalanced) return { ...last, split };
    await cancelTransaction({ orderId, amount: Number(last.payment.amount) }).catch(() => null);
    amount = split.expectedAmount;
  }
  throw new AppError('Fee Pakasir tidak dapat direkonsiliasi. Periksa konfigurasi fee metode pembayaran.', 502, 'PAKASIR_FEE_MISMATCH');
}
function safeEqual(value, expected) {
  const left = Buffer.from(String(value || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function validateWebhookShape(payload, secretHeader) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.project !== env.pakasir.slug || !/^[A-Za-z0-9._:-]{3,120}$/.test(String(payload.order_id || ''))) return false;
  const amount = Number(payload.amount);
  if (!Number.isSafeInteger(amount) || amount < 0) return false;
  if (env.pakasir.webhookSecret && !safeEqual(secretHeader, env.pakasir.webhookSecret)) return false;
  return true;
}
module.exports = { createTransaction, cancelTransaction, getTransactionDetail, simulatePayment, createReconciledTransaction, validateWebhookShape };
