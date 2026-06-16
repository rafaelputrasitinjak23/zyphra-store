const Product = require('../models/Product');
const Category = require('../models/Category');
const { escapeRegex } = require('../utils/helpers');
const { AppError } = require('../utils/errors');
async function home(req, res) {
  const [featured, categories] = await Promise.all([Product.find({ active: true, featured: true }).populate('category').sort({ createdAt: -1 }).limit(8), Category.find({ active: true }).sort({ name: 1 }).limit(12)]);
  res.render('home', { title: 'Produk digital untuk proyek Anda', featured, categories });
}
async function list(req, res) {
  const query = { active: true };
  if (req.query.q) query.$or = [{ name: new RegExp(escapeRegex(req.query.q), 'i') }, { tags: new RegExp(escapeRegex(req.query.q), 'i') }];
  if (req.query.category) { const category = await Category.findOne({ slug: req.query.category, active: true }); query.category = category?._id || null; }
  const [products, categories] = await Promise.all([Product.find(query).populate('category').sort({ featured: -1, createdAt: -1 }), Category.find({ active: true }).sort({ name: 1 })]);
  res.render('products/list', { title: 'Produk', products, categories, filters: req.query });
}
async function detail(req, res) {
  const product = await Product.findOne({ slug: req.params.slug, active: true }).populate('category');
  if (!product) throw new AppError('Produk tidak ditemukan.', 404);
  res.render('products/detail', { title: product.name, product });
}
module.exports = { home, list, detail };
