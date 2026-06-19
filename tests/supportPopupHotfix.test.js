const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

assert(read('models/StoreSetting.js').includes('Terima kasih kepada support kami'), 'default thanks title missing');
assert(read('views/partials/support-popup.ejs').includes('THANKS TO SUPPORT'), 'popup should be thanks to support');
assert(read('views/admin/support-popup.ejs').includes('Popup thanks support'), 'admin page should use thanks support wording');
assert(read('services/settingService.js').includes('Kunjungi Vercel'), 'Vercel button label should be sponsor visit label');
assert(read('services/settingService.js').includes('Kunjungi Pakasir'), 'Pakasir button label should be sponsor visit label');
assert(read('views/layouts/main.ejs').includes('4.3.1-thanks-support-popup'), 'cache version not updated');

console.log('Thanks support popup hotfix checks passed');
