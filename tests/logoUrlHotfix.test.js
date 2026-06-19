const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const logo = 'https://athars.space/uploads/b53849a1.png';
const header = fs.readFileSync(path.join(root, 'views/partials/header.ejs'), 'utf8');
const adminNav = fs.readFileSync(path.join(root, 'views/partials/admin-nav.ejs'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/css/app.css'), 'utf8');

assert(header.includes(logo), 'logo URL missing in header');
assert(adminNav.includes(logo), 'logo URL missing in admin nav');
assert(layout.includes(logo), 'logo URL missing in favicon');
assert(css.includes('brand-logo-mark'), 'logo CSS missing');
assert(layout.includes('4.5.0-logo-url'), 'cache version missing');

console.log('Logo URL hotfix checks passed');
