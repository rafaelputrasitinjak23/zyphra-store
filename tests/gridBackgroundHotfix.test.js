const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public/css/app.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');

assert(css.includes('--grid-bg'), 'grid background variable missing');
assert(css.includes('linear-gradient(var(--grid-line)'), 'grid line CSS missing');
assert(css.includes('background-attachment:fixed'), 'fixed grid background missing');
assert(main.includes('4.2.0-grid-bg'), 'CSS cache version not bumped');

console.log('Grid background hotfix checks passed');
