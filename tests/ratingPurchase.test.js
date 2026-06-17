const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseReviewPayload } = require('../services/reviewService');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('rating hanya menerima angka bulat 1 sampai 5', () => {
  assert.deepEqual(parseReviewPayload({ rating: '5', comment: 'Sangat membantu.' }), { rating: 5, comment: 'Sangat membantu.' });
  assert.throws(() => parseReviewPayload({ rating: '0' }), /1 sampai 5/);
  assert.throws(() => parseReviewPayload({ rating: '6' }), /1 sampai 5/);
  assert.throws(() => parseReviewPayload({ rating: 'empat' }), /1 sampai 5/);
});

test('komentar ulasan dibatasi 1200 karakter', () => {
  assert.throws(() => parseReviewPayload({ rating: '4', comment: 'a'.repeat(1201) }), /1.200 karakter/);
});

test('review memiliki index unik per pengguna dan produk', () => {
  assert.match(read('models/Review.js'), /schema\.index\(\{ product: 1, user: 1 \}, \{ unique: true \}\)/);
});

test('review hanya tersedia untuk pembelian yang berhasil', () => {
  const service = read('services/reviewService.js');
  assert.match(service, /paymentStatus: 'paid'/);
  assert.match(service, /accessGranted: true/);
  assert.match(service, /'items\.product': productId/);
});

test('halaman produk menampilkan rating dan form pembelian terverifikasi', () => {
  const view = read('views/products/detail.ejs');
  assert.match(view, /Rating & pengalaman pembeli/);
  assert.match(view, /PEMBELIAN TERVERIFIKASI/);
  assert.match(view, /\/reviews\/products\/<%= product\._id %>/);
});
