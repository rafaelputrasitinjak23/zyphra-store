const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { getPricedCart } = require('../services/cartService');
const { AppError } = require('../utils/errors');
async function show(req, res) { const data = await getPricedCart(req.user._id); res.render('cart/index', { title: 'Keranjang', ...data }); }
async function add(req, res) {
  const product = await Product.findOne({ _id: req.body.productId, active: true });
  if (!product) throw new AppError('Produk tidak ditemukan.', 404);
  const quantity = product.allowMultipleQuantity ? Math.max(1, Math.min(99, Number(req.body.quantity || 1))) : 1;
  if (!product.unlimitedStock && product.stock < quantity) throw new AppError('Stok tidak mencukupi.', 400);
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = new Cart({ user: req.user._id, items: [] });
  const existing = cart.items.find((item) => String(item.product) === String(product._id));
  if (existing) existing.quantity = product.allowMultipleQuantity ? Math.min(99, existing.quantity + quantity) : 1;
  else cart.items.push({ product: product._id, quantity });
  await cart.save(); req.flash('success', 'Produk ditambahkan ke keranjang.'); res.redirect('/cart');
}
async function update(req, res) {
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  if (!cart) return res.redirect('/cart');
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new AppError('Item keranjang tidak ditemukan.', 404);
  const quantity = Math.max(1, Math.min(99, Number(req.body.quantity || 1)));
  item.quantity = item.product.allowMultipleQuantity ? quantity : 1;
  await cart.save(); req.flash('success', 'Keranjang diperbarui.'); res.redirect('/cart');
}
async function remove(req, res) { await Cart.updateOne({ user: req.user._id }, { $pull: { items: { _id: req.params.itemId } } }); req.flash('success', 'Produk dihapus dari keranjang.'); res.redirect('/cart'); }
module.exports = { show, add, update, remove };
