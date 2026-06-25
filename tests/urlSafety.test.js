const test = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateIp, assertSafeExternalUrl } = require('../utils/urlSafety');

test('deteksi IP privat dan reserved mencakup IPv4 dan IPv6', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.1.2', '192.168.1.1', '169.254.1.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateIp(address), true, address);
  }
  assert.equal(isPrivateIp('8.8.8.8'), false);
  assert.equal(isPrivateIp('2606:4700:4700::1111'), false);
});

test('URL file hanya menerima HTTPS publik tanpa kredensial atau port asing', () => {
  assert.equal(assertSafeExternalUrl('https://files.example.com/product.zip#fragment'), 'https://files.example.com/product.zip');
  for (const url of [
    'http://files.example.com/a.zip',
    'https://user:pass@files.example.com/a.zip',
    'https://localhost/a.zip',
    'https://127.0.0.1/a.zip',
    'https://files.example.com:8443/a.zip'
  ]) assert.throws(() => assertSafeExternalUrl(url));
});
