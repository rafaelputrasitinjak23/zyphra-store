const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public/css/app.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');

assert(css.includes('keep website background clean white after logo hotfix'), 'white override missing');
assert(css.includes('background-image:none!important'), 'background image must be disabled');
assert(main.includes('4.5.1-logo-white-bg'), 'cache version not bumped');

console.log('Logo white background fix checks passed');
