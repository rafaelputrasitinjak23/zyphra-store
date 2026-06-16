const Cart = require('../models/Cart');
const { AppError } = require('../utils/errors');

function priceCartRow(product, requestedQuantity = 1) {
  const quantity = product.allowMultipleQuantity ? Math.max(1, Math.min(99, Number(requestedQuantity || 1))) : 1;
  if (!product.unlimitedStock && product.stock < quantity) throw new AppError(`Stok ${product.name} tidak mencukupi.`, 400, 'INSUFFICIENT_STOCK');
  const unitPrice = product.promoPrice !== null && product.promoPrice < product.price ? product.promoPrice : product.price;
  return { product, quantity, unitPrice, lineTotal: unitPrice * quantity };
}

async function getPricedCart(userId) {
  const cart = await Cart.findOne({ user: userId }).populate({ path: 'items.product', match: { active: true }, populate: { path: 'category' } });
  if (!cart) return { cart: null, items: [], subtotal: 0 };
  const items = [];
  for (const row of cart.items) {
    const product = row.product;
    if (!product) continue;
    items.push(priceCartRow(product, row.quantity));
  }
  return { cart, items, subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0) };
}
module.exports = { getPricedCart, priceCartRow };
