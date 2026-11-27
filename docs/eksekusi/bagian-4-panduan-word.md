# Bagian 4: Panduan Word

Baca `docs/rancangan.md` dan `D:\KODE_PRODUK\kafe-resto\alat\panduan-word` (pembuat panduan dengan
pustaka `docx`; hanya dibaca). Empat panduan di `docs/panduan/`, wajib ada di setiap ZIP:

1. **Panduan Pemakai Aplikasi Bengkel**: bab Pemilik (profil outlet, jasa, sparepart dan stok,
   staf, rekap dan laba kotor), Kasir (booking masuk, konfirmasi dan tolak, SPK baru, item jasa dan
   part, menugaskan mekanik, pembayaran dan nota, kirim WhatsApp, tautan lacak), Mekanik (Papan
   servis, ubah status, diagnosis), dan Pelanggan (booking dari website, melacak servis). Dengan
   tangkapan layar dari aplikasi yang berjalan.
2. **Panduan Menjalankan di Laptop** (backend Laravel + web, dengan dan tanpa Docker).
3. **Panduan Upload ke VPS**: Ubuntu, MySQL, PHP-FPM, Nginx + certbot **dengan rate limit untuk
   `/api/public/*`**, Next.js dengan systemd, cadangan database, Fonnte, dan `PUBLIC_WEB_URL`.
4. **Panduan Arsitektur dan Teknologi**.

Pakai ulang `umum.js` dan pola `buat-semua.js` kafe-resto; ganti seluruh isi domain. Langkah VPS
disusun dari README backend dan harus dicoba ujung ke ujung di VPS baru sebelum produk dijual
(catat bila belum).

## Tanda selesai

- [ ] Keempat panduan terbuka di Word tanpa dialog perbaikan.
- [ ] Pengemas Bagian 3 menyertakan keempatnya dan ZIP tetap lolos pemeriksa.
