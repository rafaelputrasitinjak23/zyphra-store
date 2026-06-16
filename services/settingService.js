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

async function getStoreSettings() {
  return StoreSetting.findOneAndUpdate(
    { key: 'store' },
    { $setOnInsert: { key: 'store', storeName: 'Zyphra Store', feeSplitThreshold: env.feeSplitThreshold, paymentFees: defaultFees } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = { getStoreSettings, defaultFees };
