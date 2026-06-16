# Zyphra Store

Zyphra Store adalah proyek e-commerce produk digital berbasis Node.js, Express.js, MongoDB, Mongoose, EJS, OAuth Google/GitHub, OTP email, Cloudflare Turnstile, dan Pakasir. Proyek ini menyediakan katalog produk, keranjang, checkout, invoice, dashboard pengguna/admin, proteksi download, webhook idempoten, dan pencatatan kegagalan email.

## Fitur utama

- Register manual dengan CAPTCHA, password bcrypt, OTP enam digit, kedaluwarsa 10 menit, cooldown, batas percobaan, dan verifikasi email.
- Login manual dengan CAPTCHA, password, OTP, proteksi brute force, session regeneration, serta notifikasi IP, perangkat, dan user-agent.
- Login Google dan GitHub tanpa CAPTCHA/OTP. Akun dengan email provider yang sudah terverifikasi dapat ditautkan ke akun dengan email yang sama.
- Reset password melalui OTP dengan respons yang tidak membocorkan status email dan invalidasi seluruh sesi lama.
- Session MongoDB, cookie `httpOnly`, `sameSite=lax`, dan `secure` pada production.
- Produk digital, kategori, promo, stok/unlimited, galeri, versi, changelog, instruksi, URL file rahasia, dan batas download.
- Keranjang MongoDB dan seluruh perhitungan harga ulang di server.
- Integrasi Pakasir via API untuk QRIS dan Virtual Account, cek status, cancel, simulasi sandbox, serta webhook.
- Pembagian fee: di bawah batas fee dibagi dua; tepat/di atas batas seluruh fee dibayar pengguna.
- Invoice web/cetak/email dengan subtotal, gateway fee, bagian pengguna, bagian merchant, total, dan merchant net.
- Endpoint download memakai session, pemeriksaan kepemilikan, token sementara, batas download, dan proxy stream agar URL file asli tidak tampil pada frontend.
- Dashboard admin untuk statistik, produk, kategori, user, order, cek ulang Pakasir, kirim ulang invoice, konfigurasi fee, log webhook, dan log email.
- Helmet, CSP, CSRF berbasis session, rate limit, sanitasi key MongoDB, validasi input, proteksi admin, dan error page production.
- Kompatibel dengan Vercel dan mode localhost.

## Persyaratan

- Node.js 20 atau lebih baru.
- MongoDB Atlas atau MongoDB replica set. Transaksi database saat pembayaran berhasil membutuhkan replica set; MongoDB Atlas sudah mendukungnya.
- Akun SMTP.
- Proyek Cloudflare Turnstile.
- OAuth app Google dan GitHub jika kedua tombol OAuth ingin diaktifkan.
- Proyek Pakasir aktif.

## Instalasi lokal

```bash
npm install
cp .env.example .env
npm run seed:admin
npm run dev
```

Pada Windows PowerShell, salin `.env.example` menjadi `.env` secara manual atau gunakan:

```powershell
Copy-Item .env.example .env
```

Buka `http://localhost:3000`.

## MongoDB Atlas

1. Buat akun dan cluster di MongoDB Atlas.
2. Buat database user dengan password kuat.
3. Tambahkan IP pengembangan ke Network Access. Untuk Vercel, aturan jaringan harus mengizinkan koneksi dari deployment Anda; banyak pengguna memakai `0.0.0.0/0` lalu mengandalkan user/password kuat, tetapi aturan yang lebih sempit lebih aman bila tersedia.
4. Ambil connection string dan isi `MONGODB_URI`.
5. Pastikan nama database ada pada URI, misalnya `mongodb+srv://user:password@cluster.mongodb.net/zyphra_store`.

## Environment variable

Salin `.env.example`, lalu isi seluruh nilai rahasia. Jangan commit `.env`.

- `APP_URL`: URL absolut tanpa slash di akhir.
- `MONGODB_URI`: connection string MongoDB.
- `SESSION_SECRET`: string acak panjang.
- `GOOGLE_*` dan `GITHUB_*`: kredensial OAuth.
- `TURNSTILE_*`: site key dan secret key Cloudflare Turnstile.
- `SMTP_*`: konfigurasi SMTP.
- `ADMIN_EMAIL`: email admin utama dan tujuan notifikasi order baru.
- `ADMIN_INITIAL_PASSWORD`: hanya dibutuhkan oleh seed saat akun admin belum ada; jangan simpan setelah seed selesai.
- `PAKASIR_*`: slug, API key, base URL, dan secret webhook opsional.
- `FEE_SPLIT_THRESHOLD`: default `50000`.
- `DOWNLOAD_TOKEN_SECRET`: string acak khusus token download.

Buat secret dengan Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Google OAuth

1. Buka Google Cloud Console, buat project, lalu konfigurasi OAuth consent screen.
2. Buat OAuth Client ID tipe Web Application.
3. Tambahkan redirect lokal: `http://localhost:3000/auth/google/callback`.
4. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan `GOOGLE_CALLBACK_URL`.
5. Setelah deploy, tambahkan `https://domain-anda/auth/google/callback` di Google Cloud dan ubah env Vercel.

## GitHub OAuth

1. Buka GitHub Settings → Developer settings → OAuth Apps → New OAuth App.
2. Homepage URL lokal: `http://localhost:3000`.
3. Authorization callback URL: `http://localhost:3000/auth/github/callback`.
4. Isi `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, dan `GITHUB_CALLBACK_URL`.
5. Setelah deploy, ubah callback menjadi `https://domain-anda/auth/github/callback`.

OAuth hanya menautkan otomatis email provider yang dinyatakan terverifikasi. Jika provider tidak memberikan email terverifikasi, aplikasi memakai email internal noreply agar tidak mengambil alih akun lain.

## Cloudflare Turnstile

1. Buka dashboard Cloudflare → Turnstile → Add site.
2. Tambahkan `localhost` untuk pengembangan dan domain deployment untuk production.
3. Isi `TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY`.
4. CAPTCHA dilewati hanya ketika secret kosong pada mode development. Pada production, konfigurasi yang kosong menghasilkan error aman.

## SMTP / Nodemailer

Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, dan `SMTP_FROM_EMAIL`.

Contoh umum port:

- Port `587` dengan `SMTP_SECURE=false` untuk STARTTLS.
- Port `465` dengan `SMTP_SECURE=true` untuk TLS langsung.

Kegagalan email disimpan pada koleksi `EmailLog` dan dapat dilihat dari dashboard admin. Invoice serta notifikasi non-OTP yang gagal dapat dicoba ulang dari halaman log; OTP harus dikirim ulang melalui alur OTP agar kode lama tidak dipakai kembali. Aplikasi tidak menyimpan password SMTP ke database.

## Pakasir

Dokumentasi resmi Pakasir menggunakan:

- Create: `POST /api/transactioncreate/{method}`.
- Detail: `GET /api/transactiondetail`.
- Cancel: `POST /api/transactioncancel`.
- Sandbox simulation: `POST /api/paymentsimulation`.
- Webhook sukses mengirim `amount`, `order_id`, `project`, `status`, `payment_method`, dan `completed_at`.

Isi:

```env
PAKASIR_SLUG=slug-proyek
PAKASIR_API_KEY=api-key-proyek
PAKASIR_BASE_URL=https://app.pakasir.com
PAKASIR_WEBHOOK_SECRET=
```

URL webhook yang dimasukkan pada halaman proyek Pakasir:

```text
https://domain-anda/webhooks/pakasir
```

Dokumentasi resmi Pakasir saat proyek ini dibuat tidak mendokumentasikan signature webhook. Karena itu aplikasi tidak pernah mempercayai webhook sebagai sumber kebenaran: `order_id`, proyek, dan amount diperiksa, lalu status dikonfirmasi lagi melalui Transaction Detail API. `PAKASIR_WEBHOOK_SECRET` bersifat opsional untuk skenario reverse proxy yang menambahkan header `x-webhook-secret`; jangan mengisinya bila Pakasir tidak mengirim header tersebut.

Metode yang disediakan:

- `qris`
- `cimb_niaga_va`
- `bni_va`
- `sampoerna_va`
- `bnc_va`
- `maybank_va`
- `permata_va`
- `atm_bersama_va`
- `artha_graha_va`
- `bri_va`

Konfigurasi fee awal mengikuti halaman biaya Pakasir per 11 Juni 2026: QRIS 0,7% + Rp310, QRIS di atas Rp105.000 menjadi 1%, VA tertentu Rp3.500, serta Artha Graha/Sampoerna Rp2.000. Karena biaya dapat berubah, admin dapat memperbaruinya melalui `/admin/settings`.

### Cara kerja pembagian fee dengan API Pakasir

Pakasir mengembalikan `fee` dan `total_payment` di atas field `amount`. Untuk transaksi di bawah batas, aplikasi menghitung bagian merchant lalu mengurangi field amount yang dikirim ke Pakasir. Setelah respons diterima, fee aktual direkonsiliasi. Jika belum seimbang akibat pembulatan/persentase, transaksi dibatalkan dan dibuat ulang maksimal beberapa kali dengan amount yang sudah dikoreksi. Order hanya disimpan sebagai siap bayar ketika:

```text
total_payment = subtotal + userFee
amount = subtotal - merchantFee
userFee = ceil(fee / 2)
merchantFee = fee - userFee
```

Untuk subtotal tepat atau di atas batas, `amount = subtotal` dan seluruh fee Pakasir menjadi bagian pengguna.

## Seed admin

Isi `ADMIN_EMAIL`. Bila user dengan email tersebut sudah ada, perintah hanya mempromosikannya menjadi admin. Bila belum ada, isi sementara `ADMIN_INITIAL_PASSWORD` dengan password kuat.

```bash
npm run seed:admin
```

Tidak ada password admin default di source code atau README.

## Menjalankan test

```bash
npm test
npm run check
```

Test mencakup fee di bawah/tepat/di atas batas, pembulatan fee ganjil, OTP kedaluwarsa dan sekali pakai, event key webhook idempoten, proteksi kepemilikan download, harga database yang tidak dapat diganti dari frontend, serta perbedaan kebijakan login manual dan OAuth.

## Menguji pembayaran sandbox

1. Aktifkan mode Sandbox pada proyek Pakasir.
2. Buat order dari website.
3. Gunakan tombol cek status setelah simulasi.
4. Simulasi dapat dipanggil melalui endpoint resmi Pakasir dengan `project`, `order_id`, `amount` yang sama dengan `pakasirAmount`, dan `api_key`.
5. Periksa `/admin/logs/webhooks` dan detail order.

Jangan menggunakan nilai total yang terlihat di browser sebagai input API. Controller checkout selalu mengambil ulang produk, stok, promo, fee, dan subtotal dari database.

## Deploy ke Vercel

1. Push proyek ke GitHub tanpa `.env`.
2. Import repository di Vercel.
3. Tambahkan seluruh environment variable dari `.env.example` pada Project Settings → Environment Variables.
4. Set `NODE_ENV=production` dan `APP_URL=https://domain-anda`.
5. Deploy.
6. Ubah callback Google/GitHub ke domain deployment.
7. Atur URL webhook Pakasir menjadi `https://domain-anda/webhooks/pakasir`.
8. Jalankan seed admin dari lokal dengan `MONGODB_URI` production, atau gunakan Vercel CLI dengan environment production.

`api/index.js` mengekspor Express app tanpa `app.listen()`. `server.js` hanya digunakan untuk localhost. Koneksi Mongoose dicache agar cold start tidak membuat koneksi baru pada setiap request. Session disimpan di MongoDB, bukan memory. Produk dan invoice tidak ditulis ke filesystem Vercel.

## Struktur utama

```text
api/                 entry point Vercel
config/              environment, database, Passport
controllers/         auth, produk, cart, checkout, order, payment, admin
emails/              template HTML email
middlewares/         auth, CSRF, rate limit, sanitasi, error
models/              schema Mongoose
public/               CSS dan JavaScript frontend
routes/               route modular
scripts/              seed admin dan pemeriksaan proyek
services/             OTP, email, CAPTCHA, Pakasir, fee, order, download
utils/                helper keamanan dan format
views/                EJS publik, akun, invoice, dan admin
tests/                test dasar
```

## Error umum

### `MONGODB_URI belum diisi`

Pastikan `.env` berada di root dan connection string lengkap.

### Transaksi MongoDB gagal dengan pesan replica set

Gunakan MongoDB Atlas atau deployment MongoDB yang mendukung transaction/replica set.

### OAuth `redirect_uri_mismatch`

Callback pada provider harus sama persis dengan environment variable, termasuk protokol dan path.

### OTP tidak terkirim

Periksa SMTP, port, TLS, app password, dan dashboard `/admin/logs/emails`.

### Turnstile selalu gagal

Pastikan hostname lokal/production sudah didaftarkan dan site key berpasangan dengan secret key yang benar.

### Webhook tidak mengubah status

Pastikan URL publik benar, amount webhook sama dengan `pakasirAmount`, proyek sama dengan slug, serta Transaction Detail API dapat diakses dengan API key.

### Fee Pakasir tidak dapat direkonsiliasi

Perbarui aturan fee pada dashboard admin sesuai biaya Pakasir terbaru. Aplikasi sengaja menolak order bila respons aktual tidak dapat menghasilkan pembagian fee yang konsisten.

### File besar gagal diproksikan di Vercel

Vercel memiliki batas durasi dan bandwidth function. Gunakan object storage yang mendukung file delivery efisien atau pindahkan endpoint download ke server yang cocok untuk streaming file besar. URL sumber tetap tidak disisipkan ke frontend.

## Catatan keamanan operasional

- Rotasi seluruh secret bila pernah terpublikasi.
- Batasi akses database dan gunakan user database khusus aplikasi.
- Gunakan HTTPS di production.
- Jangan menaruh API key di view, JavaScript frontend, database setting publik, atau repository.
- Tinjau log webhook/email secara rutin.
- Perbarui dependency dan konfigurasi fee ketika provider mengubah dokumentasi atau biaya.
