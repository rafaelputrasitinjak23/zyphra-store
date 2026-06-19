const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public/css/app.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');

assert(css.includes('restore clean white website background'), 'white background override missing');
assert(css.includes('background-image:none!important'), 'grid background must be disabled');
assert(main.includes('4.4.0-white-background'), 'CSS cache version not bumped');

console.log('White background hotfix checks passed');
