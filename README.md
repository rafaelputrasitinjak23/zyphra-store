# TOKOZYPHRA

TOKOZYPHRA adalah marketplace produk digital berbasis Node.js, Express, MongoDB/Mongoose, dan EJS. Aplikasi mencakup katalog, keranjang, checkout, produk gratis, wallet, pembayaran gateway atau hybrid, voucher, flash sale, invoice, download terproteksi, dukungan pelanggan, ulasan, dokumentasi produk, notifikasi, dashboard admin, dan AI assistant.

Versi ini telah diperkuat untuk alur transaksi production: stok per item dan kuota promo direservasi, saldo wallet ditahan secara idempoten, transaksi gateway memiliki kompensasi, order kedaluwarsa direkonsiliasi otomatis, webhook diverifikasi ulang ke provider, tindakan admin diaudit, dan file digital dapat disimpan pada object storage privat.

## Persyaratan

- Node.js 20 atau lebih baru.
- MongoDB yang mendukung transaction, yaitu MongoDB Atlas atau deployment replica set.
- SMTP bila registrasi/reset password melalui OTP akan digunakan.
- Credential Pakasir bila pembayaran eksternal diaktifkan.
- S3-compatible object storage bila memakai private object key atau migrasi avatar.

MongoDB standalone tanpa replica set tidak sesuai untuk checkout, wallet, reservasi stok, dan reservasi promo karena bagian tersebut menggunakan transaksi database.

## Instalasi

```bash
npm ci
cp .env.example .env
npm run check
npm test
npm run seed:admin
npm start
```

Untuk development dengan auto-reload:

```bash
npm run dev
```

Aplikasi melakukan validasi konfigurasi saat startup. Production tidak akan berjalan bila secret wajib kosong, lemah, sama satu sama lain, atau URL penting tidak memakai HTTPS.

## Konfigurasi penting

Gunakan `.env.example` sebagai daftar lengkap. Jangan commit `.env`.

### Aplikasi dan database

```env
NODE_ENV=production
APP_URL=https://domain-anda
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=<secret-acak-minimal-32-karakter>
DOWNLOAD_TOKEN_SECRET=<secret-acak-berbeda>
CRON_SECRET=<secret-acak-khusus-cron>
```

`SESSION_SECRET`, `DOWNLOAD_TOKEN_SECRET`, dan `CRON_SECRET` harus berbeda. `DOWNLOAD_TOKEN_SECRET` dipakai untuk token download berumur pendek, bukan sebagai secret session.

### SMTP

```env
SMTP_REQUIRED=true
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=TOKOZYPHRA
SMTP_FROM_EMAIL=
ADMIN_EMAIL=
```

Di development, `SMTP_REQUIRED=false` dapat digunakan. Di production, aktifkan SMTP agar OTP, invoice, dan notifikasi dapat dikirim.

### Pakasir

Pembayaran eksternal bersifat opt-in:

```env
PAKASIR_ENABLED=true
PAKASIR_SLUG=
PAKASIR_API_KEY=
PAKASIR_BASE_URL=https://app.pakasir.com
PAKASIR_WEBHOOK_SECRET=
```

Webhook:

```text
https://domain-anda/webhooks/pakasir
```

`PAKASIR_WEBHOOK_SECRET` bersifat opsional dan hanya diisi bila reverse proxy Anda menambahkan header `x-webhook-secret`. Validasi utama tidak bergantung pada payload webhook: aplikasi mencocokkan proyek, order, dan nominal, lalu mengambil Transaction Detail dari provider sebelum mengubah status finansial.

Biaya per metode dikelola melalui **Admin → Pengaturan**. Jangan mengandalkan angka biaya hard-coded sebagai referensi permanen; cocokkan dengan konfigurasi provider yang sedang berlaku.

### Object storage S3-compatible

```env
OBJECT_STORAGE_ENABLED=true
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_REGION=us-east-1
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
OBJECT_STORAGE_FORCE_PATH_STYLE=false
OBJECT_STORAGE_PUBLIC_BASE_URL=
OBJECT_STORAGE_AVATAR_PREFIX=avatars
OBJECT_STORAGE_PRODUCT_PREFIX=products
OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS=300
```

Catatan:

- AWS S3 dapat menggunakan endpoint kosong dan region AWS yang sesuai.
- Penyedia S3-compatible seperti R2 atau MinIO dapat mengisi endpoint khusus.
- File produk sebaiknya privat. Di form produk, simpan object key seperti `products/template.zip`.
- `OBJECT_STORAGE_PUBLIC_BASE_URL` hanya diperlukan untuk avatar yang harus dapat ditampilkan publik melalui CDN/bucket publik.
- Mode download default adalah `proxy`, sehingga URL sumber tidak tampil di frontend dan kuota dapat dikembalikan bila streaming gagal.
- Mode `redirect` hanya digunakan untuk object storage signed URL; kuota dianggap terpakai saat redirect diterbitkan.

Untuk memindahkan avatar base64 lama dari MongoDB ke object storage:

```bash
npm run migrate:avatars
```

Jalankan setelah object storage dan public base URL dikonfigurasi. Script menghapus object baru apabila penyimpanan perubahan user gagal.

## Arsitektur transaksi

### Checkout

1. Produk dan harga dibaca ulang dari database.
2. Voucher dihitung ulang di server.
3. Order dibuat dengan status `initializing` dan idempotency key.
4. Stok produk terbatas dicatat sebagai reservasi per item, sementara kuota diskon direservasi dalam transaksi MongoDB.
5. Saldo wallet dipindahkan ke `heldBalance` secara idempoten.
6. Untuk transaksi gateway, aplikasi membuat transaksi provider dan menyimpan Order serta Payment secara atomik.
7. Jika pencatatan lokal gagal setelah transaksi provider terbentuk, aplikasi mencoba cancel sebagai kompensasi.
8. Bila cancel gagal, order masuk `compensation_required` dan maintenance akan memverifikasi ulang sebelum melepaskan aset.

### Pembayaran berhasil

Dalam satu transaksi MongoDB:

- reservasi stok dikomit menjadi penjualan;
- saldo tertahan dikomit menjadi pengeluaran;
- kuota diskon dikomit;
- order menjadi `paid/fulfilled`;
- akses download diberikan;
- cart terkait dibersihkan;
- Payment diperbarui secara idempoten.

### Pembayaran gagal atau kedaluwarsa

Setelah status provider diverifikasi:

- saldo tertahan dikembalikan;
- stok reservasi per item dilepas;
- kuota diskon dilepas;
- order menjadi final non-paid;
- Payment dan notifikasi diperbarui.

Order `failed`, `expired`, `cancelled`, atau `refunded` tidak dibuka kembali setelah asetnya dilepas. Order yang masih `pending` atau `compensation_required` selalu direkonsiliasi terhadap provider terlebih dahulu.

## Maintenance dan cron

Endpoint mesin:

```text
GET /api/system/maintenance
Authorization: Bearer <CRON_SECRET>
```

Vercel cron sudah didefinisikan pada `vercel.json` setiap 10 menit. Proses maintenance:

- menutup checkout `initializing` yang macet;
- memeriksa ulang order pending yang kedaluwarsa;
- menyelesaikan `compensation_required`;
- mengembalikan saldo, stok, dan promo hanya setelah status provider aman;
- memproses deposit kedaluwarsa;
- memakai lock idempoten agar run yang bertumpuk tidak memproses order yang sama secara bersamaan.

Untuk menjalankan manual dari CLI:

```bash
npm run maintenance
```

Endpoint observability:

```text
GET /healthz
GET /readyz
GET /api/system/ready
```

`healthz` hanya menunjukkan proses aplikasi hidup. `readyz` juga memeriksa koneksi database.

## Download dan keamanan file

Akses download mensyaratkan:

- session user aktif;
- order milik user;
- payment berstatus `paid`;
- `accessGranted=true`;
- token JWT dengan issuer, audience, subject, dan expiry yang benar;
- kuota download masih tersedia.

Untuk URL legacy, server:

- hanya menerima HTTPS publik;
- menolak credential URL dan port non-443;
- menolak localhost serta IP private/reserved IPv4 dan IPv6;
- memeriksa hasil DNS;
- memvalidasi ulang setiap redirect;
- mengikat koneksi ke IP publik yang sudah diperiksa untuk mengurangi DNS rebinding;
- mengembalikan kuota bila proxy stream gagal atau client terputus.

`DOWNLOAD_ALLOWED_HOSTS` dapat digunakan sebagai allowlist domain. Kosong berarti semua host publik HTTPS diizinkan.

## Keamanan aplikasi

Implementasi utama:

- Helmet dan Content Security Policy dengan nonce;
- cookie session `httpOnly`, `sameSite=lax`, dan `secure` pada production;
- session MongoDB terenkripsi oleh `connect-mongo`;
- CSRF untuk operasi browser non-GET;
- sanitasi key MongoDB dan field sensitif;
- bcrypt cost 12;
- lock akun dan rate limiter autentikasi;
- OTP single-use dengan expiry dan batas percobaan;
- regenerasi session setelah login;
- `sessionVersion` untuk logout semua perangkat;
- rate limiter terpisah untuk browser, API, webhook, maintenance, checkout, OTP, dan AI;
- request ID dan structured JSON logging;
- audit log admin dengan redaksi secret;
- proteksi admin agar tidak menonaktifkan diri sendiri atau menghapus admin aktif terakhir.

Log audit admin tersedia di:

```text
/admin/logs/audit
```

## Frontend, responsivitas, dan PWA

- Mobile menu publik memakai drawer kanan.
- Sidebar admin menjadi drawer kiri pada layar kecil.
- Kedua drawer mendukung Escape, focus trap, focus restore, overlay, dan status ARIA.
- Breakpoint navigasi utama konsisten pada 900 px.
- Stylesheet dibagi menjadi modul `core`, `clean-ui`, `responsive`, `storefront`, `feature-pack`, dan `accessibility`.
- Service worker hanya meng-cache aset publik; halaman akun, wallet, checkout, payment, order, dan admin tidak disimpan sebagai dokumen offline.
- SEO mencakup canonical, robots, Open Graph, Twitter Card, dan JSON-LD Product/Offer/Rating.
- Sorting harga memakai harga efektif, termasuk promo dan flash sale aktif.

## Pengujian

```bash
npm run check
npm test
npm run test:integration
npm audit --omit=dev
```

`npm run check` memeriksa file wajib, sintaks seluruh JavaScript, dan kompilasi template EJS.

Test biasa tidak membutuhkan database. Test integrasi konkurensi membutuhkan database replica set terpisah:

```env
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
```

Test integrasi membuat database sementara, menguji dua reservasi stok dan promo secara bersamaan, lalu menghapus database tersebut. Tanpa `TEST_MONGODB_URI`, test integrasi akan ditandai `SKIP`, bukan dianggap lulus eksekusi database.

## Seed admin

```env
ADMIN_EMAIL=admin@example.com
ADMIN_INITIAL_PASSWORD=<password-kuat-sementara>
```

```bash
npm run seed:admin
```

Bila user dengan email tersebut sudah ada, script mempromosikannya menjadi admin. Jangan menyimpan password awal di repository atau environment lebih lama dari yang diperlukan.

## Deployment Vercel

1. Push repository tanpa `.env` dan `node_modules`.
2. Import repository ke Vercel.
3. Tambahkan environment variable production berdasarkan `.env.example`.
4. Gunakan MongoDB Atlas/replica set.
5. Set `NODE_ENV=production` dan `APP_URL=https://domain-anda`.
6. Isi `CRON_SECRET` agar Vercel Cron dapat mengautentikasi endpoint maintenance.
7. Aktifkan Pakasir hanya setelah credential dan webhook siap.
8. Deploy, buka `/readyz`, lalu lakukan checkout sandbox end-to-end.
9. Jalankan seed admin menggunakan environment production.

`package-lock.json` disertakan agar build menggunakan dependency tree yang reproducible. Gunakan `npm ci`, bukan menghapus lockfile.

## Operasional production

Sebelum menerima uang pengguna:

- uji checkout gratis, wallet, gateway, hybrid, voucher, expiry, cancel, dan webhook;
- jalankan test konkurensi pada replica set;
- pastikan cron benar-benar terpanggil;
- pastikan SMTP mengirim OTP dan invoice;
- lakukan uji download file kecil dan besar;
- cek audit log, webhook log, email log, dan structured log;
- rotasi secret yang pernah terpublikasi;
- backup database dan aktifkan alert provider/database;
- pantau order `compensation_required`;
- tinjau ulang aturan fee provider secara berkala.

## Struktur proyek

```text
api/                 entry point serverless
config/              database dan environment
controllers/         request/response layer
emails/              template email
middlewares/         auth, CSRF, limiter, sanitasi, observability
models/              schema MongoDB
public/               JavaScript, CSS modular, manifest, service worker
routes/               route modular
scripts/              seed, maintenance, migrasi, pemeriksaan proyek
services/             logika bisnis dan integrasi
utils/                helper keamanan dan logging
views/                template EJS publik, akun, dan admin
tests/                unit/source tests dan integration concurrency test
```

## Perintah tersedia

```text
npm run dev              development server
npm start                production-style server
npm test                 test utama
npm run test:integration test konkurensi MongoDB
npm run check            pemeriksaan struktur/sintaks/template
npm run seed:admin       membuat atau mempromosikan admin
npm run maintenance      menjalankan maintenance manual
npm run migrate:avatars  migrasi avatar base64 ke object storage
```
