const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const required = ['app.js','server.js','api/index.js','package.json','.env.example','vercel.json','README.md','views/layouts/main.ejs','public/css/app.css'];
let failed = false;
for (const file of required) { if (!fs.existsSync(path.join(root, file))) { console.error(`File hilang: ${file}`); failed = true; } }
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
for (const file of walk(root).filter((f) => f.endsWith('.js') && !f.includes('node_modules'))) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status !== 0) { console.error(result.stderr); failed = true; } }
if (failed) process.exit(1); console.log('Pemeriksaan struktur dan sintaks selesai tanpa error.');
