const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readStyles = () => [
  'public/css/app.css',
  'public/css/core.css',
  'public/css/clean-ui.css',
  'public/css/responsive.css',
  'public/css/storefront.css',
  'public/css/feature-pack.css',
  'public/css/accessibility.css'
].map(read).join('\n');

module.exports = { root, read, readStyles };
