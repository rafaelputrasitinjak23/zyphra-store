const axios = require('axios');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const { normalizeAuthoritativeFee } = require('./feeService');

function ensureConfig() {
  if (!env.pakasir.slug || !env.pakasir.apiKey) throw new AppError('Pakasir belum dikonfigurasi.', 503, 'PAKASIR_NOT_CONFIGURED');
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
    return data;
  } catch (error) {
    return { cancelled: false, error: error.response?.data || error.message };
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
    await cancelTransaction({ orderId, amount: Number(last.payment.amount) });
    amount = split.expectedAmount;
  }
  throw new AppError('Fee Pakasir tidak dapat direkonsiliasi. Periksa konfigurasi fee metode pembayaran.', 502, 'PAKASIR_FEE_MISMATCH');
}
function validateWebhookShape(payload, secretHeader) {
  if (!payload || payload.project !== env.pakasir.slug || !payload.order_id || !Number.isInteger(Number(payload.amount))) return false;
  if (env.pakasir.webhookSecret && secretHeader !== env.pakasir.webhookSecret) return false;
  return true;
}
module.exports = { createTransaction, cancelTransaction, getTransactionDetail, simulatePayment, createReconciledTransaction, validateWebhookShape };
