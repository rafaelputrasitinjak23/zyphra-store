# Zyphra Store

Zyphra Store adalah proyek e-commerce produk digital berbasis Node.js, Express.js, MongoDB, Mongoose, EJS, autentikasi email, CAPTCHA teks bawaan, OTP untuk registrasi/reset password, produk gratis Rp0, dan Pakasir. Proyek ini menyediakan katalog produk, keranjang, checkout, invoice, dashboard pengguna/admin, proteksi download, pembatalan transaksi pending, chatbot AI berbasis katalog, generator deskripsi produk, webhook idempoten, dan pencatatan kegagalan email.

## Fitur utama

### Pengalaman akun marketplace

- Dashboard akun modern dengan foto profil, statistik pesanan, total belanja, pesanan terbaru, dan akses cepat.
- Pengguna dapat mengunggah foto profil JPG/PNG/WebP hingga 750 KB; foto disimpan di MongoDB agar kompatibel dengan Vercel tanpa filesystem lokal.
- Profil mendukung nama, nomor telepon, bio singkat, dan preferensi notifikasi.
- Navigasi bawah mobile menggunakan ikon SVG untuk Beranda, Belanja, Pesanan, Koleksi, dan Akun.
- Halaman keamanan untuk perubahan password dan logout seluruh perangkat.


- Register manual dengan CAPTCHA, password bcrypt, OTP enam digit, kedaluwarsa 10 menit, cooldown, batas percobaan, dan verifikasi email.
- Login manual langsung dengan email, password, dan CAPTCHA teks tanpa OTP, disertai proteksi brute force, session regeneration, serta notifikasi IP, perangkat, dan user-agent.
- Reset password melalui OTP dengan respons yang tidak membocorkan status email dan invalidasi seluruh sesi lama.
- Session MongoDB, cookie `httpOnly`, `sameSite=lax`, dan `secure` pada production.
- Produk digital, kategori, promo, stok/unlimited, galeri, versi, changelog, instruksi, URL file rahasia, dan batas download.
- Keranjang MongoDB dan seluruh perhitungan harga ulang di server.
- Produk dapat memiliki harga mulai dari Rp0. Harga normal, promo, atau flash sale boleh bernilai nol.
- Voucher/kode promo boleh memberi diskon hingga 100% atau sebesar seluruh subtotal sehingga total akhir menjadi Rp0.
- Pesanan dengan total Rp0 tidak membuat transaksi Pakasir, tidak menampilkan QRIS/VA, langsung dikonfirmasi sebagai berhasil, mengurangi stok sekali, mencatat penggunaan voucher, memberi akses download, dan membuat invoice.
- Integrasi Pakasir via API untuk QRIS dan Virtual Account, cek status, cancel, simulasi sandbox, serta webhook.
- Pengguna dan admin dapat membatalkan transaksi pending. Server mengecek status Pakasir sebelum dan setelah pembatalan agar transaksi yang sudah lunas tidak ikut dibatalkan.
- Chatbot Zyphra Assistant mengambil konteks produk aktif, kategori, harga, stok, serta aturan website langsung dari database tanpa mengirim URL file digital atau credential.
- Tombol AI pada form admin dapat membuat deskripsi singkat, deskripsi lengkap, tag, instruksi, dan changelog; fallback lokal tetap tersedia saat API AI gagal.
- Harga terlihat pada kartu dan halaman detail, tersedia tombol Beli Sekarang, produk terkait, riwayat produk dilihat, sorting, pagination, statistik terjual/dilihat, dan countdown pembayaran.
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
- CAPTCHA teks sudah tersedia di dalam proyek dan tidak memerlukan layanan atau API key eksternal.
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
- `SMTP_*`: konfigurasi SMTP.
- `ADMIN_EMAIL`: email admin utama dan tujuan notifikasi order baru.
- `ADMIN_INITIAL_PASSWORD`: hanya dibutuhkan oleh seed saat akun admin belum ada; jangan simpan setelah seed selesai.
- `PAKASIR_*`: slug, API key, base URL, dan secret webhook opsional.
- `FEE_SPLIT_THRESHOLD`: default `50000`.
- `DOWNLOAD_TOKEN_SECRET`: string acak khusus token download.
- `AI_ENABLED`, `AI_BASE_URL`, `AI_PATH`, `AI_TEMPERATURE`, dan `AI_TIMEOUT_MS`: konfigurasi chatbot serta generator konten produk.

Buat secret dengan Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## CAPTCHA teks bawaan

CAPTCHA dibuat langsung oleh server sebagai gambar SVG berisi lima karakter. Pengguna cukup mengetik teks yang terlihat pada form login, register, atau lupa password.

- Tidak membutuhkan akun Cloudflare.
- Tidak membutuhkan `SITE_KEY` atau `SECRET_KEY`.
- Kode berlaku selama 5 menit.
- Kode hanya dapat digunakan satu kali.
- Tombol **Muat ulang kode** membuat kode baru.
- Challenge disimpan pada session MongoDB dalam bentuk hash HMAC, bukan teks asli.

## SMTP / Nodemailer

Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, dan `SMTP_FROM_EMAIL`.

Contoh umum port:

- Port `587` dengan `SMTP_SECURE=false` untuk STARTTLS.
- Port `465` dengan `SMTP_SECURE=true` untuk TLS langsung.

Kegagalan email disimpan pada koleksi `EmailLog` dan dapat dilihat dari dashboard admin. Invoice serta notifikasi non-OTP yang gagal dapat dicoba ulang dari halaman log; OTP registrasi/reset password harus dikirim ulang melalui alur OTP agar kode lama tidak dipakai kembali. Aplikasi tidak menyimpan password SMTP ke database.

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

Konfigurasi fee awal mengikuti halaman biaya Pakasir yang tersedia saat proyek diperbarui: QRIS 0,7% + Rp310, QRIS di atas Rp105.000 menjadi 1%, VA tertentu Rp3.500, serta Artha Graha/Sampoerna Rp2.000. Karena biaya dapat berubah, admin dapat memperbaruinya melalui `/admin/settings`.

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

Test mencakup fee di bawah/tepat/di atas batas, pembulatan fee ganjil, produk Rp0, promo Rp0, checkout gratis tanpa gateway fee, voucher 100% hingga total nol, OTP registrasi/reset yang kedaluwarsa dan sekali pakai, login tanpa OTP, CAPTCHA teks sekali pakai, flash sale, voucher semua produk, promo produk tertentu, event key webhook idempoten, proteksi download, harga database, parser AI, dan pembatalan transaksi.

## Chatbot AI dan auto-deskripsi produk

API default mengikuti endpoint yang diminta:

```env
AI_ENABLED=true
AI_BASE_URL=https://api.siputzx.my.id
AI_PATH=/api/ai/glm47flash
AI_TEMPERATURE=0.7
AI_TIMEOUT_MS=30000
```

Chatbot hanya menerima konteks publik yang dipilih server: nama produk, deskripsi singkat, kategori, harga, stok, versi, tag, batas download, dan URL halaman publik. `digitalFileUrl`, data SMTP, session secret, API key Pakasir, dan data pribadi pengguna tidak dimasukkan ke prompt. Riwayat percakapan dibatasi di session dan endpoint dilindungi CSRF serta rate limit.

Pada dashboard admin, buka form tambah/edit produk lalu isi minimal nama dan kategori. Tekan **Generate dengan AI**. Jika API tidak tersedia atau respons bukan JSON valid, server mengisi template konten lokal agar form tetap dapat digunakan. Chatbot juga memiliki jawaban fallback untuk bantuan dasar dan rekomendasi produk saat layanan AI eksternal sedang gagal.

## Produk gratis dan checkout Rp0

Admin dapat membuat produk gratis dengan mengisi harga `0`. Harga promo dan harga flash sale juga dapat diisi `0` selama memenuhi aturan harga yang lebih rendah dari harga aktif.

Voucher atau kode promo boleh membuat subtotal setelah diskon menjadi tepat `Rp0`. Untuk pesanan seperti ini:

1. Website tidak meminta pengguna memilih QRIS atau Virtual Account.
2. Tidak ada request pembuatan transaksi ke Pakasir.
3. Order disimpan dengan metode `free`, fee gateway `0`, dan total `0`.
4. Status langsung menjadi `paid` dan `fulfilled` melalui konfirmasi internal.
5. Stok dan jumlah terjual diperbarui satu kali.
6. Kuota voucher dicatat satu kali.
7. Produk langsung muncul di **Produk Saya** dan dapat diunduh.
8. Invoice dan notifikasi email tetap dibuat.

Jika keranjang berisi produk gratis dan berbayar sekaligus, payment gateway hanya digunakan selama subtotal akhir masih lebih dari Rp0.

## Pembatalan transaksi

Pengguna dapat membatalkan order melalui halaman pembayaran atau detail pesanan selama status masih `pending`. Admin juga dapat membatalkan dari detail order. Alurnya:

1. Server memastikan order milik pengguna dan belum dibayar.
2. Server mengecek Transaction Detail Pakasir.
3. Jika sudah `completed`, order diproses sebagai paid dan pembatalan ditolak.
4. Jika masih pending, server memanggil Transaction Cancel Pakasir.
5. Server mengecek ulang status dan menyimpan waktu, pelaku, alasan, serta respons pembatalan.

Pembatalan dibuat idempoten dan menggunakan lock database agar klik berulang tidak menjalankan proses bersamaan.

## Menguji pembayaran sandbox

1. Aktifkan mode Sandbox pada proyek Pakasir.
2. Buat order dari website.
3. Gunakan tombol cek status setelah simulasi.
4. Simulasi dapat dipanggil melalui endpoint resmi Pakasir dengan `project`, `order_id`, `amount` yang sama dengan `pakasirAmount`, dan `api_key`.
5. Periksa `/admin/logs/webhooks` dan detail order.

Jangan menggunakan nilai total yang terlihat di browser sebagai input API. Controller checkout selalu mengambil ulang produk, stok, promo, fee, dan subtotal dari database.

## Deploy ke Vercel

1. Push proyek ke GitHub tanpa `.env`. ZIP ini sengaja tidak menyertakan `package-lock.json`; Vercel akan memasang dependency dari `package.json`.
2. Import repository di Vercel.
3. Tambahkan seluruh environment variable dari `.env.example` pada Project Settings → Environment Variables.
4. Set `NODE_ENV=production` dan `APP_URL=https://domain-anda`.
5. Deploy.
6. Atur URL webhook Pakasir menjadi `https://domain-anda/webhooks/pakasir`.
7. Jalankan seed admin dari lokal dengan `MONGODB_URI` production, atau gunakan Vercel CLI dengan environment production.

`api/index.js` mengekspor Express app tanpa `app.listen()`. `server.js` hanya digunakan untuk localhost. Koneksi Mongoose dicache agar cold start tidak membuat koneksi baru pada setiap request. Session disimpan di MongoDB, bukan memory. Produk dan invoice tidak ditulis ke filesystem Vercel.

## Struktur utama

```text
api/                 entry point Vercel
config/              environment dan database
controllers/         auth, produk, cart, checkout, order, payment, AI, admin
emails/              template HTML email
middlewares/         auth, CSRF, rate limit, sanitasi, error
models/              schema Mongoose
public/               CSS dan JavaScript frontend
routes/               route modular
scripts/              seed admin dan pemeriksaan proyek
services/             OTP, email, CAPTCHA, Pakasir, fee, order, pembatalan, AI, download
utils/                helper keamanan dan format
views/                EJS publik, akun, invoice, dan admin
tests/                test dasar
```

## Error umum

### `MONGODB_URI belum diisi`

Pastikan `.env` berada di root dan connection string lengkap.

### Transaksi MongoDB gagal dengan pesan replica set

Gunakan MongoDB Atlas atau deployment MongoDB yang mendukung transaction/replica set.

### OTP tidak terkirim

Periksa SMTP, port, TLS, app password, dan dashboard `/admin/logs/emails`.

### CAPTCHA tidak terlihat

Pastikan gambar dari `/auth/captcha.svg` tidak diblokir browser. Muat ulang halaman atau tekan tombol **Muat ulang kode**. Session MongoDB juga harus aktif agar challenge dapat diverifikasi.

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
