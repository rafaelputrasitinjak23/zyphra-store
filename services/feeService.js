const { AppError } = require('../utils/errors');

function calculateGatewayFee(amount, rule) {
  if (!Number.isInteger(amount) || amount < 0) throw new AppError('Nominal transaksi tidak valid.', 400, 'INVALID_AMOUNT');
  if (!rule || !rule.active) throw new AppError('Metode pembayaran tidak tersedia.', 400, 'PAYMENT_METHOD_UNAVAILABLE');
  if (rule.type === 'fixed') return Math.max(0, Math.ceil(rule.fixed || 0));
  if (rule.type === 'percentage_plus_fixed') return Math.max(0, Math.ceil(amount * Number(rule.percentage || 0) + Number(rule.fixed || 0)));
  if (rule.type === 'tiered_qris') {
    if (amount > Number(rule.highThreshold || 105000)) return Math.max(0, Math.ceil(amount * Number(rule.highPercentage || 0.01)));
    return Math.max(0, Math.ceil(amount * Number(rule.percentage || 0.007) + Number(rule.fixed || 310)));
  }
  throw new AppError('Konfigurasi fee tidak didukung.', 500, 'INVALID_FEE_CONFIG');
}

function calculateFeeSplit(subtotal, rule, threshold = 50000) {
  if (!Number.isInteger(subtotal) || subtotal <= 0) throw new AppError('Subtotal harus berupa integer Rupiah.', 400, 'INVALID_SUBTOTAL');
  if (subtotal >= threshold) {
    const gatewayFee = calculateGatewayFee(subtotal, rule);
    return { subtotal, gatewayFee, userFee: gatewayFee, merchantFee: 0, total: subtotal + gatewayFee, merchantNet: subtotal, pakasirAmount: subtotal };
  }

  let pakasirAmount = subtotal;
  let gatewayFee = 0;
  for (let i = 0; i < 20; i += 1) {
    gatewayFee = calculateGatewayFee(pakasirAmount, rule);
    const nextAmount = subtotal - Math.floor(gatewayFee / 2);
    if (nextAmount <= 0) throw new AppError('Subtotal terlalu kecil untuk metode pembayaran ini.', 400, 'FEE_EXCEEDS_SUBTOTAL');
    if (nextAmount === pakasirAmount) break;
    pakasirAmount = nextAmount;
  }
  gatewayFee = calculateGatewayFee(pakasirAmount, rule);
  const merchantFee = gatewayFee - Math.ceil(gatewayFee / 2);
  const userFee = gatewayFee - merchantFee;
  pakasirAmount = subtotal - merchantFee;
  return {
    subtotal,
    gatewayFee,
    userFee,
    merchantFee,
    total: pakasirAmount + gatewayFee,
    merchantNet: subtotal - merchantFee,
    pakasirAmount
  };
}

function normalizeAuthoritativeFee(subtotal, threshold, payment) {
  const gatewayFee = Number(payment.fee);
  const pakasirAmount = Number(payment.amount);
  const totalPayment = Number(payment.total_payment);
  if (![gatewayFee, pakasirAmount, totalPayment].every(Number.isInteger)) throw new AppError('Respons nominal Pakasir tidak valid.', 502, 'INVALID_PAKASIR_AMOUNT');
  if (totalPayment !== pakasirAmount + gatewayFee) throw new AppError('Total Pakasir tidak konsisten.', 502, 'PAKASIR_TOTAL_MISMATCH');
  const merchantFee = subtotal >= threshold ? 0 : Math.floor(gatewayFee / 2);
  const userFee = gatewayFee - merchantFee;
  const expectedAmount = subtotal - merchantFee;
  return {
    subtotal, gatewayFee, userFee, merchantFee,
    merchantNet: subtotal - merchantFee,
    pakasirAmount,
    total: totalPayment,
    expectedAmount,
    isBalanced: pakasirAmount === expectedAmount && totalPayment === subtotal + userFee
  };
}

module.exports = { calculateGatewayFee, calculateFeeSplit, normalizeAuthoritativeFee };
