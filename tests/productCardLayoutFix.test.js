const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("thumbnail kartu produk memiliki tinggi tetap sehingga nama dan harga terlihat", () => {
  const css = fs.readFileSync(path.join(__dirname, "../public/css/app.css"), "utf8");
  assert.match(css, /\.product-image\s*\{[^}]*display:block[^}]*height:230px[^}]*flex:0 0 230px/s);
  assert.match(css, /\.product-image img\s*\{[^}]*object-fit:contain/s);
});

test("stylesheet menggunakan cache busting agar perubahan tampil setelah deploy", () => {
  const layout = fs.readFileSync(path.join(__dirname, "../views/layouts/main.ejs"), "utf8");
  assert.match(layout, /app\.css\?v=1\.4\.2-cardfix/);
});
