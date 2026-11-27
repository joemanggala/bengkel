# Aturan bersama semua pelaksana

Beberapa pelaksana bisa bekerja bersamaan di repo ini dan di laptop yang sama. Aturan ini
mencegah saling tabrak. Berkas ini catatan internal: `docs/eksekusi/` tidak ikut dikemas ke
paket jualan.

## Kepemilikan folder

| Folder | Pemilik | Yang lain |
|---|---|---|
| `spec/`, `db/`, `tests/kontrak/`, `tests/wa-palsu/`, `docker-compose.yml`, `docs/menjalankan.md`, `README.md`, `.gitignore` | Bagian 0 (fondasi dan alat uji) | hanya dibaca |
| `backend-laravel/` | Bagian 1 | tidak disentuh |
| `web/` | Bagian 2 | tidak disentuh |
| `tests/e2e/`, `alat/kemas-varian/` | Bagian 3 | tidak disentuh |
| `alat/panduan-word/`, `docs/panduan/` | Bagian 4 | tidak disentuh |
| `backend-go/`, `backend-nestjs/`, `mobile/` | bagian menyusul | belum ada |

Butuh perubahan di folder milik pelaksana lain, terutama spec atau tes kontrak? Jangan ubah
sendiri. Tulis di laporan: apa, kenapa, dan usulan perubahannya.

## Port

| Layanan | Dev | Uji (tes kontrak) |
|---|---|---|
| MySQL bengkel (docker, proyek compose `bengkel`) | 3350 | 3350 |
| Backend Go (menyusul) | 8801 | 8881 (`bengkel_uji`) |
| Backend Laravel | 8802 | 8882 (`bengkel_uji_laravel`) |
| Backend NestJS (menyusul) | 8803 | 8883 (`bengkel_uji_nestjs`) |
| Web Next.js | 3800 | 3880 (bila perlu) |
| WhatsApp palsu | 8890 | 8891 (Go), 8892 (Laravel), 8893 (NestJS) |

| Keperluan | Port | Database |
|---|---|---|
| Review independen | 8861-8870 | `bengkel_review_*` |
| E2E (Bagian 3): backend | 8811-8813 | `bengkel_e2e_go`, `bengkel_e2e_laravel`, `bengkel_e2e_nestjs` |
| E2E: WA palsu | 8814-8816 | |
| E2E: web | 3811-3813 | |

Kontainer MySQL bengkel dikelola Bagian 0. Jangan menjalankan `docker compose down`, menghapus
volume, atau membuat ulang kontainer. Setiap backend hanya memakai database ujinya sendiri.

## Gaya bahasa

Sapaan **"kamu"** di seluruh teks UI, pesan galat, dan pesan WhatsApp, bukan "Anda" (sama
dengan produk lain).

## Yang tidak boleh disentuh

- Produk lain di `D:\KODE_PRODUK` (`laundry`, `tokoonline`, `kafe-resto`, `sistemakademik`,
  dan lainnya): **hanya dibaca**, sebagai acuan pola. Kontainer, database, dan prosesnya (MySQL
  3310, 3320, 3330, 3340; port 84xx, 85xx, 86xx, 87xx, 3400, 3500, 3600, 3700) juga tidak
  disentuh.
- `D:\KODE_BELAJAR` (toko KodeCoding) dan `D:\POS_IDEORA`: hanya dibaca. Kontainer, database,
  dan prosesnya (MySQL 3309; port 8201-8203, 3200, 8290-8292, 2526) tidak disentuh.
- `D:\KODE_PRODUK\ahws-racing` (situs AHWS Racing Team milik klien pengguna): proyek terpisah,
  **tidak disentuh dan tidak dijadikan acuan**. Jangan menyalin kode, teks, atau asetnya ke
  produk ini.
- Kontainer lain yang sedang berjalan di Docker (mis. `hr-mysql`, `tmn_mysql`,
  `mtds-platform-*`, `cms-sekolah-*`) bukan milik proyek ini.

## Aturan kode

- Setiap berkas kode diawali tepat dua baris header (penanda komentar sesuai bahasanya):
  ```
  // Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
  // Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.
  ```
- Kode ini dijual sebagai bahan belajar: rapi, mudah dibaca, dan komentar penjelas berbahasa
  Indonesia yang menerangkan *mengapa*. Teks UI dan pesan berbahasa Indonesia; kode status, kode
  galat, dan field JSON berbahasa Inggris (camelCase).
- Tanpa ORM. Maksimal ±1.000 baris per berkas.
- Dependensi dipatok persis, berumur minimal dua minggu, dan sebisa mungkin sama dengan versi
  di kafe-resto supaya cache terpakai.
- Identitas netral: nama bengkel diambil dari profil outlet (bawaan "Nama Bengkel"), tanpa nama
  atau logo KodeCoding, dan tanpa nama atau logo AHWS.
- Jangan commit kecuali diminta. Jangan menulis kredensial sungguhan. Jangan mencetak isi
  berkas `.env`.
- Matikan proses yang kamu nyalakan sendiri sebelum selesai.

## Dua tahap per backend dan web

- **Tahap A:** kerangka yang tidak bergantung pada detail spec: susunan proyek, tooling,
  konfigurasi, lapisan infrastruktur, pembantu dengan aturan pasti (token, bcrypt, nomor HP,
  plat, rupiah, aturan status SPK dan booking), dan tesnya. Berhenti dan laporkan.
- **Tahap B:** mengisi semua fitur sesuai spec sampai tanda selesai bagian itu terpenuhi.

Jangan menebak bentuk respons API yang belum ada di spec. Bagian yang bergantung pada API
dibuat di balik antarmuka (interface/repository) supaya tahap B tinggal mengisinya.

## Acuan pola (hanya dibaca)

| Hal | Lihat di |
|---|---|
| Struktur backend Laravel, lapisan infrastruktur, pembantu | `D:\KODE_PRODUK\kafe-resto\backend-laravel`, `D:\KODE_PRODUK\laundry\backend-laravel` (README masing-masing) |
| Kartu stok, harga beli khusus pemilik, stok berkurang dan kembali | `D:\KODE_PRODUK\kafe-resto` (modul stok di backend, spec, dan tes kontrak) |
| Rute publik dengan token (`bookingToken`, `trackingToken`) | `D:\KODE_PRODUK\kafe-resto` (`qrToken`, `trackingToken`) |
| Web: BFF, cookie, panel gaya admin, cetak nota 58 mm | `D:\KODE_PRODUK\kafe-resto\web`, `D:\KODE_PRODUK\laundry\web` |
| Web: halaman publik | `D:\KODE_PRODUK\tokoonline\web\src\app\(toko)`, `D:\KODE_PRODUK\kafe-resto\web` |
| Desain web (token warna, tes kontras, tata letak admin, komponen) | `D:\KODE_PRODUK\kafe-resto\web` (`src/app/globals.css`, `src/tema`), yang meniru admin KodeCoding di `D:\KODE_BELAJAR\frontend` |
| Harness tes kontrak, WhatsApp palsu | `D:\KODE_PRODUK\kafe-resto\tests\kontrak`, `tests\wa-palsu` |
| Pengemas paket dan pembuat panduan Word | `D:\KODE_PRODUK\kafe-resto\alat` |

Salin pola, bukan isi bisnisnya: kafe-resto punya menu, meja, QR, pajak, dan resep yang **tidak**
ada di produk ini; produk ini punya pelanggan, kendaraan, booking, SPK, mekanik, dan sparepart
yang tidak ada di kafe-resto.
