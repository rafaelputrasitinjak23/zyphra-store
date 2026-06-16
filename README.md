# Zyphra Store

Zyphra Store adalah proyek e-commerce produk digital berbasis Node.js, Express.js, MongoDB, Mongoose, EJS, autentikasi email, OTP melalui Nodemailer, Cloudflare Turnstile, dan Pakasir. Proyek menyediakan katalog produk, keranjang, checkout, invoice, dashboard pengguna/admin, proteksi download, webhook idempoten, dan pencatatan kegagalan email.

## Fitur utama

- Autentikasi hanya menggunakan email dan password.
- Register dengan CAPTCHA, password bcrypt, OTP enam digit, masa berlaku 10 menit, cooldown, batas percobaan, dan verifikasi email.
- Login dengan CAPTCHA, password, OTP, proteksi brute force, regenerasi session, serta notifikasi IP, perangkat, dan user-agent.
- Reset password melalui OTP dengan respons yang tidak membocorkan status email dan invalidasi seluruh sesi lama.
- Session MongoDB, cookie `httpOnly`, `sameSite=lax`, dan `secure` pada production.
- Produk digital, kategori, promo, stok/unlimited, galeri, versi, changelog, instruksi, URL file rahasia, dan batas download.
- Keranjang MongoDB dan seluruh perhitungan harga ulang di server.
- Integrasi Pakasir untuk QRIS dan Virtual Account, cek status, cancel, simulasi sandbox, serta webhook.
- Pembagian fee: di bawah batas fee dibagi dua; tepat atau di atas batas seluruh fee dibayar pengguna.
- Invoice web, cetak, dan email dengan subtotal, gateway fee, bagian pengguna, bagian merchant, total, dan merchant net.
- Endpoint download memakai session, pemeriksaan kepemilikan, token sementara, batas download, dan proxy stream agar URL file asli tidak tampil pada frontend.
- Dashboard admin untuk statistik, produk, kategori, pengguna, order, cek ulang Pakasir, kirim ulang invoice, konfigurasi fee, log webhook, dan log email.
- Helmet, CSP, CSRF berbasis session, rate limit, sanitasi key MongoDB, validasi input, proteksi admin, dan error page production.
- Kompatibel dengan Vercel dan mode localhost.

## Persyaratan

- Node.js 20 atau lebih baru.
- MongoDB Atlas atau MongoDB replica set. Transaksi database saat pembayaran berhasil membutuhkan replica set; MongoDB Atlas sudah mendukungnya.
- Akun SMTP untuk OTP dan notifikasi email.
- Proyek Cloudflare Turnstile.
- Proyek Pakasir aktif.

## Instalasi lokal

```bash
npm install
cp .env.example .env
npm run seed:admin
npm run dev
```

Pada Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Buka `http://localhost:3000`.

## MongoDB Atlas

1. Buat akun dan cluster di MongoDB Atlas.
2. Buat database user dengan password kuat.
3. Tambahkan IP pengembangan ke Network Access.
4. Ambil connection string dan isi `MONGODB_URI`.
5. Pastikan nama database ada pada URI, misalnya `mongodb+srv://user:password@cluster.mongodb.net/zyphra_store`.

Untuk Vercel, jaringan MongoDB harus mengizinkan koneksi dari deployment. Aturan `0.0.0.0/0` sering digunakan bersama user/password kuat, tetapi pembatasan jaringan yang lebih sempit tetap lebih aman bila tersedia.

## Environment variable

Salin `.env.example` menjadi `.env`, lalu isi seluruh nilai rahasia. Jangan commit `.env`.

- `APP_URL`: URL absolut tanpa slash di akhir.
- `MONGODB_URI`: connection string MongoDB.
- `SESSION_SECRET`: string acak panjang untuk session.
- `SESSION_TTL_DAYS`: umur session dalam hari.
- `TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY`: konfigurasi CAPTCHA.
- `SMTP_*`: konfigurasi pengiriman OTP dan notifikasi.
- `ADMIN_EMAIL`: email admin utama dan tujuan notifikasi order baru.
- `ADMIN_INITIAL_PASSWORD`: hanya dibutuhkan saat membuat admin pertama.
- `PAKASIR_*`: slug, API key, base URL, dan secret webhook opsional.
- `FEE_SPLIT_THRESHOLD`: batas pembagian fee, default `50000`.
- `DOWNLOAD_TOKEN_SECRET`: secret khusus token download.
- `DOWNLOAD_TOKEN_TTL`: masa berlaku token download, default `5m`.

Buat secret dengan Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Alur autentikasi email

### Register

1. Pengguna mengisi nama, email, password, dan konfirmasi password.
2. Cloudflare Turnstile diverifikasi server-side.
3. Password di-hash dengan bcrypt.
4. OTP enam digit dikirim melalui email.
5. Akun aktif setelah OTP berhasil diverifikasi.

### Login

1. Pengguna mengisi email dan password.
2. Cloudflare Turnstile diverifikasi server-side.
3. Password divalidasi dan percobaan gagal dibatasi.
4. OTP login dikirim melalui email.
5. Session ID diregenerasi setelah OTP benar.
6. User ID dan versi session disimpan di MongoDB session store.

### Lupa password

1. Pengguna memasukkan email dan menyelesaikan CAPTCHA.
2. Respons selalu dibuat umum agar status email tidak bocor.
3. OTP reset dikirim bila akun valid.
4. Password baru menginvalidasi seluruh session lama.

Akun lama yang sebelumnya belum mempunyai password dapat menggunakan halaman lupa password untuk membuat password baru melalui OTP email.

## Cloudflare Turnstile

1. Buka dashboard Cloudflare → Turnstile → Add site.
2. Tambahkan `localhost` untuk pengembangan dan domain deployment untuk production.
3. Isi `TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY`.
4. CAPTCHA dilewati hanya ketika secret kosong pada mode development. Pada production, konfigurasi kosong menghasilkan error aman.

## SMTP / Nodemailer

Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, dan `SMTP_FROM_EMAIL`.

Contoh umum:

- Port `587` dengan `SMTP_SECURE=false` untuk STARTTLS.
- Port `465` dengan `SMTP_SECURE=true` untuk TLS langsung.

Kegagalan email disimpan pada koleksi `EmailLog` dan dapat dilihat dari dashboard admin. Invoice serta notifikasi non-OTP yang gagal dapat dicoba ulang dari halaman log. OTP harus dikirim ulang melalui alur OTP agar kode lama tidak dipakai kembali. Password SMTP tidak disimpan ke database.

## Pakasir

Integrasi menggunakan endpoint:

- Create: `POST /api/transactioncreate/{method}`.
- Detail: `GET /api/transactiondetail`.
- Cancel: `POST /api/transactioncancel`.
- Sandbox simulation: `POST /api/paymentsimulation`.

Isi konfigurasi:

```env
PAKASIR_SLUG=slug-proyek
PAKASIR_API_KEY=api-key-proyek
PAKASIR_BASE_URL=https://app.pakasir.com
PAKASIR_WEBHOOK_SECRET=
```

URL webhook:

```text
https://domain-anda/webhooks/pakasir
```

Aplikasi tidak mempercayai webhook sebagai sumber kebenaran tunggal. `order_id`, proyek, dan amount diperiksa, lalu status dikonfirmasi kembali melalui Transaction Detail API. `PAKASIR_WEBHOOK_SECRET` bersifat opsional untuk reverse proxy yang menambahkan header `x-webhook-secret`.

Metode yang tersedia:

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

Konfigurasi fee awal dapat diperbarui melalui `/admin/settings` agar tetap sesuai dengan biaya Pakasir terbaru.

### Pembagian fee

Untuk subtotal di bawah batas:

```text
userFee = ceil(gatewayFee / 2)
merchantFee = gatewayFee - userFee
totalPaidByUser = subtotal + userFee
merchantNet = subtotal - merchantFee
```

Untuk subtotal tepat atau di atas batas:

```text
userFee = gatewayFee
merchantFee = 0
totalPaidByUser = subtotal + gatewayFee
merchantNet = subtotal
```

Pakasir mengembalikan `fee` dan `total_payment` di atas field `amount`. Aplikasi merekonsiliasi fee aktual dan hanya menyimpan order sebagai siap bayar ketika total API konsisten dengan pembagian fee server-side.

## Seed admin

Isi `ADMIN_EMAIL`. Bila pengguna dengan email tersebut sudah ada, perintah hanya mempromosikannya menjadi admin. Bila belum ada, isi sementara `ADMIN_INITIAL_PASSWORD` dengan password kuat.

```bash
npm run seed:admin
```

Tidak ada password admin default di source code atau README.

## Menjalankan test

```bash
npm test
npm run check
```

Test mencakup fee di bawah, tepat, dan di atas batas; pembulatan fee ganjil; OTP kedaluwarsa dan sekali pakai; event key webhook idempoten; proteksi kepemilikan download; harga database yang tidak dapat diganti dari frontend; serta kebijakan autentikasi email dengan CAPTCHA, password, dan OTP.

## Menguji pembayaran sandbox

1. Aktifkan mode Sandbox pada proyek Pakasir.
2. Buat order dari website.
3. Jalankan simulasi pembayaran dengan `project`, `order_id`, `amount` yang sama dengan `pakasirAmount`, dan `api_key`.
4. Gunakan tombol cek status pada detail order admin.
5. Periksa `/admin/logs/webhooks` dan detail order.

Controller checkout selalu membaca ulang produk, stok, promo, fee, dan subtotal dari database. Nilai dari browser tidak menjadi sumber kebenaran.

## Deploy ke Vercel

1. Push proyek ke repository tanpa `.env`.
2. Import repository di Vercel.
3. Tambahkan seluruh environment variable dari `.env.example` pada Project Settings → Environment Variables.
4. Set `NODE_ENV=production` dan `APP_URL=https://domain-anda`.
5. Deploy.
6. Atur URL webhook Pakasir menjadi `https://domain-anda/webhooks/pakasir`.
7. Jalankan seed admin dari lokal menggunakan `MONGODB_URI` production atau melalui environment production Vercel CLI.

`api/index.js` mengekspor Express app tanpa `app.listen()`. `server.js` hanya digunakan untuk localhost. Koneksi Mongoose dicache agar cold start tidak membuat koneksi baru pada setiap request. Session disimpan di MongoDB, bukan memory. Produk dan invoice tidak ditulis ke filesystem Vercel.

## Struktur utama

```text
api/                 entry point Vercel
config/              environment dan database
controllers/         auth, produk, cart, checkout, order, payment, admin
emails/              template HTML email
middlewares/         session auth, CSRF, rate limit, sanitasi, error
models/              schema Mongoose
public/              CSS dan JavaScript frontend
routes/              route modular
scripts/             seed admin dan pemeriksaan proyek
services/            OTP, email, CAPTCHA, Pakasir, fee, order, download
utils/               helper keamanan dan format
views/               EJS publik, akun, invoice, dan admin
tests/               test dasar
```

## Error umum

### `MONGODB_URI belum diisi`

Pastikan `.env` berada di root dan connection string lengkap.

### Transaksi MongoDB gagal dengan pesan replica set

Gunakan MongoDB Atlas atau deployment MongoDB yang mendukung transaction/replica set.

### OTP tidak terkirim

Periksa SMTP, port, TLS, app password, dan dashboard `/admin/logs/emails`.

### Turnstile selalu gagal

Pastikan hostname lokal/production sudah didaftarkan dan site key berpasangan dengan secret key yang benar.

### Webhook tidak mengubah status

Pastikan URL publik benar, amount webhook sama dengan `pakasirAmount`, proyek sama dengan slug, serta Transaction Detail API dapat diakses menggunakan API key.

### Fee Pakasir tidak dapat direkonsiliasi

Perbarui aturan fee pada dashboard admin sesuai biaya Pakasir terbaru. Aplikasi sengaja menolak order bila respons aktual tidak dapat menghasilkan pembagian fee yang konsisten.

### File besar gagal diproksikan di Vercel

Vercel memiliki batas durasi dan bandwidth function. Gunakan object storage yang mendukung file delivery efisien atau pindahkan endpoint download ke server yang cocok untuk streaming file besar. URL sumber tetap tidak disisipkan ke frontend.

## Catatan keamanan operasional

- Rotasi seluruh secret bila pernah terpublikasi.
- Batasi akses database dan gunakan user database khusus aplikasi.
- Gunakan HTTPS di production.
- Jangan menaruh API key di view, JavaScript frontend, database setting publik, atau repository.
- Tinjau log webhook dan email secara rutin.
- Perbarui dependency dan konfigurasi fee ketika layanan pembayaran mengubah dokumentasi atau biaya.
