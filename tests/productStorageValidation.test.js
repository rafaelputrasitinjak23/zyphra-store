const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Product = require('../models/Product');

test('produk baru wajib memiliki URL file atau object key', async () => {
  const product = new Product({
    name: 'Test',
    slug: `test-${Date.now()}`,
    shortDescription: 'Deskripsi',
    description: 'Deskripsi lengkap',
    price: 1000,
    category: new mongoose.Types.ObjectId(),
    thumbnail: 'https://example.com/image.png'
  });
  await assert.rejects(product.validate(), /memerlukan URL file atau object key storage/);
});

test('dokumen lama yang field privatnya tidak dipilih tetap dapat divalidasi saat field lain berubah', async () => {
  const product = Product.hydrate({
    _id: new mongoose.Types.ObjectId(),
    name: 'Existing',
    slug: 'existing',
    shortDescription: 'Deskripsi',
    description: 'Deskripsi lengkap',
    price: 1000,
    category: new mongoose.Types.ObjectId(),
    thumbnail: 'https://example.com/image.png',
    active: true
  });
  product.active = false;
  await product.validate();
});
