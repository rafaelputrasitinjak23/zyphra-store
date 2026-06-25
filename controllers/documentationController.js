const Product = require('../models/Product');
const ProductDocumentation = require('../models/ProductDocumentation');
const Order = require('../models/Order');
const { AppError } = require('../utils/errors');
const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');

function parseFaq(body) {
  const questions = Array.isArray(body.faqQuestion) ? body.faqQuestion : [body.faqQuestion].filter(Boolean);
  const answers = Array.isArray(body.faqAnswer) ? body.faqAnswer : [body.faqAnswer].filter(Boolean);
  return questions.map((question, index) => ({ question: String(question || '').trim(), answer: String(answers[index] || '').trim() })).filter(item => item.question && item.answer);
}

async function publicDoc(req, res) {
  const product = await Product.findOne({ slug: req.params.slug, active: true }).populate('category');
  if (!product) throw new AppError('Produk tidak ditemukan.', 404, 'PRODUCT_NOT_FOUND');

  const doc = await ProductDocumentation.findOne({ product: product._id, published: true });
  res.render('docs/product', { title: `Dokumentasi ${product.name}`, product, doc });
}

async function adminIndex(req, res) {
  const products = await Product.find().populate('category').sort({ createdAt: -1 }).limit(200);
  const docs = await ProductDocumentation.find({ product: { $in: products.map(p => p._id) } }).select('product published updatedAt');
  const map = new Map(docs.map(doc => [String(doc.product), doc]));
  res.render('admin/documentation/index', { title: 'Dokumentasi Produk', products, docs: map });
}

async function adminEdit(req, res) {
  const product = await Product.findById(req.params.productId).populate('category');
  if (!product) throw new AppError('Produk tidak ditemukan.', 404, 'PRODUCT_NOT_FOUND');
  const doc = await ProductDocumentation.findOne({ product: product._id });
  res.render('admin/documentation/edit', { title: `Dokumentasi ${product.name}`, product, doc });
}

async function adminUpdate(req, res) {
  const product = await Product.findById(req.params.productId);
  if (!product) throw new AppError('Produk tidak ditemukan.', 404, 'PRODUCT_NOT_FOUND');

  const payload = {
    quickStart: String(req.body.quickStart || '').trim(),
    requirements: String(req.body.requirements || '').trim(),
    installation: String(req.body.installation || '').trim(),
    configuration: String(req.body.configuration || '').trim(),
    usage: String(req.body.usage || '').trim(),
    faq: parseFaq(req.body),
    published: req.body.published === 'on',
    updatedBy: req.user._id
  };

  const before = await ProductDocumentation.findOne({ product: product._id }).lean();
  const doc = await ProductDocumentation.findOneAndUpdate({ product: product._id }, { $set: payload, $setOnInsert: { product: product._id } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  await auditService.record({ req, action: 'documentation.update', entityType: 'ProductDocumentation', entityId: doc._id, before, after: doc, metadata: { productId: product._id } });

  if (doc.published) {
    const buyers = await Order.distinct('user', { paymentStatus: 'paid', 'items.product': product._id });
    await Promise.all(buyers.map(userId => notificationService.notifyUser(userId, {
      type: 'product',
      title: 'Dokumentasi produk diperbarui',
      message: `Dokumentasi ${product.name} telah diperbarui.`,
      url: `/docs/${product.slug}`,
      data: { product: product._id }
    })));
  }

  req.flash('success', 'Dokumentasi produk berhasil disimpan.');
  res.redirect('/admin/documentation');
}

module.exports = { publicDoc, adminIndex, adminEdit, adminUpdate };
