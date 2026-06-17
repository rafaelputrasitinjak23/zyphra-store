const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ejs = require('ejs');

const root = path.join(__dirname, '..');
const required = [
  'app.js',
  'server.js',
  'api/index.js',
  'package.json',
  '.env.example',
  '.npmrc',
  'vercel.json',
  'README.md',
  'views/layouts/main.ejs',
  'public/css/app.css',
  'models/Wallet.js',
  'models/WalletTransaction.js',
  'models/WalletDeposit.js',
  'models/WalletVoucherClaim.js',
  'services/walletService.js',
  'controllers/walletController.js',
  'routes/walletRoutes.js',
  'views/wallet/index.ejs',
  'views/wallet/deposit.ejs',
  'views/admin/wallets.ejs',
  'models/Review.js',
  'services/reviewService.js',
  'controllers/reviewController.js',
  'routes/reviewRoutes.js',
  'views/admin/reviews.ejs'
];

let failed = false;

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`File hilang: ${file}`);
    failed = true;
  }
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.git', '.vercel'].includes(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const files = walk(root);

for (const file of files.filter((item) => item.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`Syntax JavaScript gagal: ${path.relative(root, file)}`);
    console.error(result.stderr);
    failed = true;
  }
}

for (const file of files.filter((item) => item.endsWith('.ejs'))) {
  try {
    ejs.compile(fs.readFileSync(file, 'utf8'), { filename: file });
  } catch (error) {
    console.error(`Compile EJS gagal: ${path.relative(root, file)}`);
    console.error(error.message);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Pemeriksaan struktur, sintaks JavaScript, dan template EJS selesai tanpa error.');
