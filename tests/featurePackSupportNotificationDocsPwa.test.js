const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

assert(read('app.js').includes("app.use('/support'"), 'support route must be mounted');
assert(read('app.js').includes("app.use('/notifications'"), 'notification route must be mounted');
assert(read('app.js').includes("app.use('/docs'"), 'documentation route must be mounted');
assert(fs.existsSync(path.join(root, 'models/SupportTicket.js')), 'SupportTicket model missing');
assert(fs.existsSync(path.join(root, 'models/Notification.js')), 'Notification model missing');
assert(fs.existsSync(path.join(root, 'models/ProductDocumentation.js')), 'ProductDocumentation model missing');
assert(fs.existsSync(path.join(root, 'public/manifest.webmanifest')), 'PWA manifest missing');
assert(fs.existsSync(path.join(root, 'public/sw.js')), 'service worker missing');
assert(read('routes/adminRoutes.js').includes("router.get('/support'"), 'admin support route missing');
assert(read('routes/adminRoutes.js').includes("router.get('/documentation'"), 'admin documentation route missing');
assert(read('views/partials/header.ejs').includes('/notifications'), 'header notification link missing');
assert(read('views/products/detail.ejs').includes('/docs/<%= product.slug %>'), 'product docs CTA missing');

console.log('Feature pack checks passed');
