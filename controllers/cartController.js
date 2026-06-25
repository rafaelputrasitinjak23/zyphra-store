const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { getPricedCart } = require('../services/cartService');
const { hasAvailableStock } = require('../utils/inventory');
const { AppError } = require('../utils/errors');
const { safeReturnTo } = require('../utils/helpers');

async function show(req, res) {
  const data = await getPricedCart(req.user._id);
  res.render('cart/index', { title: 'Keranjang', ...data });
}

async function add(req, res) {
  const product = await Product.findOne({ _id: req.body.productId, active: true }).select('+reservedStock');
  if (!product) throw new AppError('Produk tidak ditemukan.', 404);

  const requested = product.allowMultipleQuantity ? Math.max(1, Math.min(99, Number(req.body.quantity || 1))) : 1;
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = new Cart({ user: req.user._id, items: [] });

  const existing = cart.items.find((item) => String(item.product) === String(product._id));
  const nextQuantity = existing && product.allowMultipleQuantity ? Math.min(99, existing.quantity + requested) : 1;
  if (!hasAvailableStock(product, nextQuantity)) throw new AppError('Stok tidak mencukupi.', 400, 'INSUFFICIENT_STOCK');

  if (existing) existing.quantity = nextQuantity;
  else cart.items.push({ product: product._id, quantity: requested });

  await cart.save();
  req.flash('success', 'Produk ditambahkan ke keranjang.');
  res.redirect(safeReturnTo(req.body.next, '/cart'));
}

async function update(req, res) {
  const cart = await Cart.findOne({ user: req.user._id }).populate({ path: 'items.product', select: '+reservedStock' });
  if (!cart) return res.redirect('/cart');
  const item = cart.items.id(req.params.itemId);
  if (!item || !item.product?.active) throw new AppError('Item keranjang tidak ditemukan.', 404);

  const requested = Math.max(1, Math.min(99, Number(req.body.quantity || 1)));
  const nextQuantity = item.product.allowMultipleQuantity ? requested : 1;
  if (!hasAvailableStock(item.product, nextQuantity)) throw new AppError('Stok tidak mencukupi.', 400, 'INSUFFICIENT_STOCK');

  item.quantity = nextQuantity;
  await cart.save();
  req.flash('success', 'Keranjang diperbarui.');
  return res.redirect('/cart');
}

async function remove(req, res) {
  await Cart.updateOne({ user: req.user._id }, { $pull: { items: { _id: req.params.itemId } } });
  req.flash('success', 'Produk dihapus dari keranjang.');
  res.redirect('/cart');
}

module.exports = { show, add, update, remove };
