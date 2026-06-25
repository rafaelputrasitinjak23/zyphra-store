function finiteNonNegative(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function availableStock(product) {
  if (product?.unlimitedStock) return Number.POSITIVE_INFINITY;
  return Math.max(0, finiteNonNegative(product?.stock) - finiteNonNegative(product?.reservedStock));
}

function hasAvailableStock(product, quantity = 1) {
  const requested = Math.max(1, Number(quantity || 1));
  return product?.unlimitedStock || availableStock(product) >= requested;
}

module.exports = { availableStock, hasAvailableStock };
