const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const detail = fs.readFileSync(path.join(root, 'views/products/detail.ejs'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/css/feature-pack.css'), 'utf8');

assert(detail.includes('product-info-card'), 'product info card class missing');
assert(detail.includes('product-info-list'), 'product info list class missing');
assert(detail.includes('instruction-steps'), 'instruction steps markup missing');
assert(detail.includes('instructionSteps'), 'instruction parser missing');
assert(css.includes('.product-info-list'), 'product info CSS missing');
assert(css.includes('.instruction-steps'), 'instruction steps CSS missing');

console.log('Product detail neat hotfix checks passed');
