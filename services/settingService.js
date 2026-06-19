const StoreSetting = require('../models/StoreSetting');
const { env } = require('../config/env');

const defaultFees = [
  { method: 'qris', label: 'QRIS', type: 'tiered_qris', percentage: 0.007, fixed: 310, highPercentage: 0.01, highThreshold: 105000, active: true },
  { method: 'bri_va', label: 'BRI Virtual Account', type: 'fixed', fixed: 3500, active: true },
  { method: 'bni_va', label: 'BNI Virtual Account', type: 'fixed', fixed: 3500, active: true },
  { method: 'atm_bersama_va', label: 'ATM Bersama Virtual Account', type: 'fixed', fixed: 3500, active: true },
  { method: 'bnc_va', label: 'BNC Virtual Account', type: 'fixed', fixed: 3500, active: true },
  { method: 'cimb_niaga_va', label: 'CIMB Niaga Virtual Account', type: 'fixed', fixed: 3500, active: true },
  { method: 'maybank_va', label: 'Maybank Virtual Account', type: 'fixed', fixed: 3500, active: true },
  { method: 'permata_va', label: 'Permata Virtual Account', type: 'fixed', fixed: 3500, active: true },
  { method: 'artha_graha_va', label: 'Artha Graha Virtual Account', type: 'fixed', fixed: 2000, active: true },
  { method: 'sampoerna_va', label: 'Sampoerna Virtual Account', type: 'fixed', fixed: 2000, active: true }
];

const defaultSupportPopup = {
  enabled: true,
  showOnHomeOnly: true,
  showOncePerSession: true,
  title: 'Terima kasih kepada support kami',
  description: 'Website ini dapat berjalan dan menerima pembayaran dengan dukungan layanan dari Vercel dan Pakasir.',
  primaryNote: 'Partner yang membantu Zyphra Store tetap berjalan.',
  vercel: {
    enabled: true,
    title: 'Vercel',
    description: 'Platform deployment yang membantu Zyphra Store berjalan cepat, stabil, dan mudah diakses.',
    label: 'Kunjungi Vercel',
    url: 'https://vercel.com'
  },
  pakasir: {
    enabled: true,
    title: 'Pakasir',
    description: 'Layanan pembayaran yang membantu proses transaksi digital menjadi lebih praktis.',
    label: 'Kunjungi Pakasir',
    url: 'https://pakasir.com'
  }
};

function normalizeSupportPopup(popup = {}) {
  return {
    ...defaultSupportPopup,
    ...popup,
    vercel: { ...defaultSupportPopup.vercel, ...(popup.vercel || {}) },
    pakasir: { ...defaultSupportPopup.pakasir, ...(popup.pakasir || {}) }
  };
}

async function getStoreSettings() {
  const settings = await StoreSetting.findOneAndUpdate(
    { key: 'store' },
    { $setOnInsert: { key: 'store', storeName: 'Zyphra Store', feeSplitThreshold: env.feeSplitThreshold, paymentFees: defaultFees, wallet: { enabled: true, minDeposit: 10000, maxDeposit: 5000000 }, supportPopup: defaultSupportPopup } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  let changed = false;
  if (!settings.wallet) {
    settings.wallet = { enabled: true, minDeposit: 10000, maxDeposit: 5000000 };
    changed = true;
  }
  if (!settings.paymentFees?.length) {
    settings.paymentFees = defaultFees;
    changed = true;
  }
  const normalized = normalizeSupportPopup(settings.supportPopup || {});
  const current = JSON.stringify(settings.supportPopup || {});
  if (current !== JSON.stringify(normalized)) {
    settings.supportPopup = normalized;
    changed = true;
  }
  if (changed) await settings.save();
  return settings;
}

module.exports = { getStoreSettings, defaultFees, defaultSupportPopup, normalizeSupportPopup };
