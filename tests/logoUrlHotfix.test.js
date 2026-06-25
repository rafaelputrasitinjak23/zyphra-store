const test = require('node:test');
const assert = require('node:assert/strict');
const { read, readStyles } = require('./helpers/projectFiles');

test('branding tidak bergantung pada hotlink logo eksternal', () => {
  const header = read('views/partials/header.ejs');
  const adminNav = read('views/partials/admin-nav.ejs');
  const layout = read('views/layouts/main.ejs');
  const css = readStyles();
  assert.match(header, /class="brand-mark">T</);
  assert.match(adminNav, /class="brand-mark">T</);
  assert.doesNotMatch(header + adminNav + layout, /athars\.space\/uploads/);
  assert.match(css, /\.brand-mark/);
  assert.match(layout, /6\.0\.0-production-hardening/);
});
