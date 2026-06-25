const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

test('healthz tetap hidup tanpa membuka koneksi session/database', async () => {
  const response = await request(app).get('/healthz');
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.service, 'tokozyphra');
  assert.match(response.headers['x-request-id'], /^[A-Za-z0-9-]{8,128}$/);
});
