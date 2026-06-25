# Perbaikan Prioritas 0, 1, dan 2

## Prioritas 0 — transaksi dan deployment

- Runtime config divalidasi sebelum aplikasi dimuat.
- Secret default production dihapus; session/download secret wajib kuat dan berbeda.
- `.env.example`, `.gitignore`, `.npmrc`, dan `package-lock.json` ditambahkan.
- Reservasi stok atomik per item ditambahkan untuk mencegah overselling saat order pending, termasuk ketika admin mengubah mode stok terbatas/unlimited.
- Reservasi kuota promo per order/user ditambahkan untuk mencegah race condition.
- Status `initializing` dan `compensation_required` ditambahkan.
- Checkout melakukan cancel kompensasi bila transaksi provider terbentuk tetapi persistensi lokal gagal.
- Snapshot transaksi provider disimpan untuk retry maintenance bila kompensasi gagal.
- Maintenance cron merekonsiliasi order/deposit kedaluwarsa dan melepaskan saldo, stok, serta promo secara idempoten.
- Download quota baru dikonsumsi setelah upstream tersedia dan di-rollback bila proxy stream gagal.
- Proteksi SSRF mencakup DNS resolution, private/reserved IP, redirect validation, dan DNS pinning.
- OAuth yang tidak lengkap dan tidak terhubung dihapus.
- Seluruh test lama yang mengunci hotfix CSS usang disesuaikan ke kontrak UI terbaru.

## Prioritas 1 — hardening dan observability

- Rate limiter browser, API, webhook, maintenance, auth, OTP, checkout, review, dan AI dipisahkan.
- Webhook divalidasi sebelum log dibuat dan diverifikasi ulang ke provider.
- Structured logging, request ID, health check, dan readiness check ditambahkan. Session store dibuat lazy agar `/healthz` tidak bergantung pada database.
- Audit log admin ditambahkan dengan redaksi password, token, API key, URL/key file privat, dan payload sensitif.
- Proteksi self-demotion dan last-active-admin ditambahkan secara transactional.
- Popup support tidak lagi memasukkan data database melalui template `innerHTML`.
- Batas avatar frontend/backend disamakan menjadi 750 KB.
- Test konkurensi reservasi stok dan promo ditambahkan untuk MongoDB replica set.

## Prioritas 2 — maintainability dan frontend

- CSS monolitik dipisah menjadi beberapa stylesheet modular.
- Mobile menu publik dan admin memiliki focus trap, focus restore, Escape, overlay, resize handling, dan ARIA state.
- Service worker diaktifkan dan dibatasi hanya untuk aset publik.
- Sorting harga efektif memperhitungkan promo dan flash sale aktif.
- Canonical, robots, Open Graph, Twitter Card, dan JSON-LD ditambahkan.
- Dukungan object storage S3-compatible ditambahkan untuk file produk privat dan avatar.
- Signed URL berumur pendek tersedia untuk mode redirect; proxy tetap menjadi default.
- Script migrasi avatar base64 ke object storage ditambahkan.
- README operasional dan daftar environment diperbarui sepenuhnya.


## Hasil verifikasi paket

- `npm run check`: lulus, termasuk sintaks JavaScript dan kompilasi seluruh template EJS.
- `npm test`: 79 test lulus, 0 gagal.
- `npm audit --omit=dev`: 0 kerentanan dependency production.
- Module-load smoke test: 101 modul aplikasi berhasil dimuat.
- Validasi konfigurasi production: konfigurasi kuat diterima dan secret placeholder ditolak.
- Test integrasi konkurensi tersedia, tetapi hanya dijalankan bila `TEST_MONGODB_URI` menunjuk MongoDB replica set; tanpa variabel tersebut statusnya `SKIP`.
