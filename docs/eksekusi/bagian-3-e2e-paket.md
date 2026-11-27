# Bagian 3: E2E dan paket jualan

Baca `docs/rancangan.md`, `docs/eksekusi/aturan-bersama.md`, dan `docs/menjalankan.md`. Dikerjakan
setelah backend Laravel dan web hijau. Acuan: `D:\KODE_PRODUK\kafe-resto\tests\e2e` dan
`D:\KODE_PRODUK\kafe-resto\alat\kemas-varian` (hanya dibaca).

## A. E2E web (`tests/e2e/`)

Playwright + TypeScript, versi sama dengan kafe-resto, header hak cipta seperti berkas lain. Satu
perintah per backend (`npm run e2e -- --backend=laravel`, siap ditambah `go|nestjs` nanti);
harness menyalakan backend, WA palsu, dan web di port E2E (lihat `aturan-bersama.md`: Laravel
8812, WA palsu 8815, web 3812, database `bengkel_e2e_laravel`), mengosongkan databasenya, lalu
mematikan semuanya. Web untuk E2E dibuild ke folder terpisah supaya tidak bentrok dengan build
dev.

Skenario minimal:

- setup pemilik → profil outlet → jasa (satu publik, satu tidak publik, satu nonaktif) → sparepart
  dengan stok dan harga beli → akun kasir dan mekanik;
- **booking publik:** pelanggan membuka `/`, melihat jasa publik saja, booking → halaman status
  Menunggu → kasir mengonfirmasi → WA tiba di WA palsu → kasir menjadikan SPK;
- **SPK:** kasir menambah jasa dan part (stok berkurang), part melebihi stok ditolak, mekanik
  masuk dan hanya melihat SPK miliknya, menandai Dikerjakan → Menunggu part → Dikerjakan →
  Selesai → WA siap diambil tiba → pelanggan membuka tautan lacak dan melihat total → kasir
  mencoba Diambil sebelum lunas (ditolak) → bayar sebagian lalu lunas → Diambil → rekap pemilik
  cocok (termasuk laba kotor);
- kasir menolak booking dengan alasan; pelanggan membatalkan booking sendiri;
- SPK dibatalkan dengan alasan → stok part kembali;
- buat ulang tautan lacak → tautan lama menampilkan pesan tidak berlaku;
- kasir dan mekanik tidak bisa membuka Rekap, Staf, Outlet, Jasa, atau Sparepart.

## B. Pengemas paket (`alat/kemas-varian/`)

Pindahkan dan sesuaikan pengemas kafe-resto: pemilihan berkas berbasis git, ZIP deterministik,
pemeriksa isi paket, ubah dokumen saat pengemasan, dan `node:test`. Untuk sekarang hanya satu
varian: **`bengkel-laravel-web-<versi>.zip`** di `dist/paket/` (versi dari berkas `VERSION`),
disusun supaya varian `go`, `nestjs`, dan paket `-web-mobile` bisa ditambah tanpa mengubah
rancangan pengemas.

- **Isi:** `backend-laravel/`, `web/`, `spec/`, `db/`, `docs/menjalankan.md`, `docs/panduan/`,
  `tests/wa-palsu/`, `docker-compose.yml`, `LICENSE`, `.gitignore`, `VERSION`, dan README paket dari
  templat.
- **Tidak ikut:** `tests/kontrak/`, `tests/e2e/`, `alat/`, `docs/eksekusi/`, `docs/rancangan.md`,
  `.env*` kecuali `.env.example`, dependensi, hasil build, runner `migrate-uji*`, database uji
  backend lain di `db/init`.
- **Pemeriksa** menolak paket yang masih merujuk hal yang tidak ikut, paket tanpa `LICENSE`,
  header hak cipta, atau panduan Word, serta teks "KodeCoding" di luar LICENSE, README paket, dan
  header hak cipta. Menolak juga teks atau gambar AHWS.
- **Verifikasi:** ekstrak ZIP ke scratchpad, lalu dari hasil ekstrak jalankan tes unit backend,
  typecheck + test + build web, dan tes WA palsu; ZIP dibaca rapi oleh Python `zipfile`.

## C. Review independen

Seperti produk lain (`D:\KODE_PRODUK\laundry\docs\eksekusi\review.md`): peninjau yang tidak menulis
kodenya mencari bug uang, stok, dan data (total, sisa, stok negatif atau tidak kembali, nomor
ganda, status yang bisa dilompati), keamanan (rute `/api/public/*`, token booking dan lacak,
kebocoran `costPrice` dan HP, akses mekanik ke SPK orang lain, pengalihan terbuka di web), dan
celah tes. Port 8861-8870, database `bengkel_review_*`.

## Tanda selesai

- [ ] E2E web hijau melawan Laravel.
- [ ] ZIP lolos pemeriksa dan verifikasi hasil ekstrak; tes pengemas hijau.
- [ ] Temuan review dicatat dan yang nyata diperbaiki pemilik foldernya.
- [ ] Semua proses milikmu mati.
