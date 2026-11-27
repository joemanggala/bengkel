# Bagian 1: Backend Laravel

Baca `docs/rancangan.md`, `docs/eksekusi/aturan-bersama.md`, `spec/`, dan `docs/menjalankan.md`.
Acuan pola: `D:\KODE_PRODUK\kafe-resto\backend-laravel` (paling dekat: rute publik dengan token,
kartu stok, harga beli khusus pemilik) dan `D:\KODE_PRODUK\laundry\backend-laravel`. Laravel 13 di
PHP 8.4, Query Builder (`DB::table`), **tanpa Eloquent dan tanpa migration Laravel** (skema dari
`db/migrations`), modul di `app/Modules/<Modul>`. Modul SPK wajib di `app/Modules/Servis/` dengan
`ServisService.php`; modul lain mengikuti nama bahasa Indonesia (`Booking`, `Pelanggan`,
`Kendaraan`, `Jasa`, `Sparepart`, `Stok`, `Pembayaran`, `Rekap`, `Staf`, `Outlet`, `WhatsApp`).

**Laravel adalah backend pertama produk ini**, jadi tidak ada backend pembanding. Bila spec
ambigu, putuskan sesuai pola kafe-resto, catat di laporan, dan usulkan perjelasan spec ke
koordinator (jangan ubah `spec/` atau `tests/` sendiri).

## Tahap A

- Proyek Laravel, `.env.example`, validasi env saat menyala, koneksi MySQL UTC, perintah serve
  seperti kafe-resto bila memang dibutuhkan (jelaskan alasannya di README).
- Penangan galat dengan bentuk JSON spec, guard sesi staf kustom yang membaca `staff_sessions`,
  paginasi, pembantu validasi.
- Pembantu yang aturannya sudah pasti di spec, masing-masing dengan unit test: token sesi dan token
  publik, bcrypt cost 12 yang hash-nya cocok dengan fixtur lintas backend, normalisasi nomor HP,
  penyamaran HP, normalisasi dan tampilan plat, format rupiah dan tanggal WIB, aturan transisi
  status SPK dan booking.
- README awal. PHPUnit dan Pint bersih.

## Tahap B

Semua rute di spec dan klien WhatsApp. Jebakan yang sudah diketahui dari kafe-resto:

- Matikan `TrimStrings` dan `ConvertEmptyStringsToNull`; validasi tipe JSON harus persis.
- `$` di regex PHP menerima baris baru di akhir; pakai `\z` atau pengubah `D`.
- Waktu `Y-m-d H:i:s.v` UTC, `'timezone' => '+00:00'`.
- Server bawaan PHP melayani satu permintaan sekaligus: uji penguncian (nomor SPK dan booking,
  stok terakhir, batas 3 booking menunggu, setup bersamaan) juga di Nginx + PHP-FPM (atau
  php-cgi seperti kafe-resto; Nginx tersedia di Laragon `C:\laragon\bin\nginx` bila ada) sebelum
  dinyatakan benar, dan tulis caranya di README.
- Pengiriman WhatsApp tidak boleh membuat transaksi gagal; pesan dicatat sebelum dan sesudah
  dikirim, batas waktu penyedia sesuai spec.

## Tanda selesai

- [ ] Seluruh tes kontrak hijau di `:8882` dengan database `bengkel_uji_laravel` dan WA palsu
      `:8892`, berurutan dan diacak, plus varian setup mati (bila ada di tes).
- [ ] Tes serentak hijau di server yang melayani permintaan paralel.
- [ ] PHPUnit dan Pint bersih.
- [ ] README lengkap untuk pembeli (menjalankan, env, Fonnte sungguhan, produksi).
- [ ] Setiap berkas diawali dua baris header hak cipta; tidak ada berkas lebih dari ±1.000 baris.

## Laporan akhir

Jumlah tes kontrak lulus/dilewati, jumlah tes PHPUnit, bug tes atau spec yang ditemukan beserta
usulannya, keputusan yang kamu ambil sendiri, dan pertanyaan terbuka.
