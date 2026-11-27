# Tes E2E web

Satu perintah per backend. Harness mengosongkan database E2E backend itu, membuild web dan
menyalakan backend, WhatsApp palsu, dan web di port E2E-nya, menjalankan tes Playwright di browser
sungguhan, lalu mematikan semuanya (juga saat Ctrl+C).

Prasyarat: MySQL bengkel menyala (`docker compose up -d mysql`) dengan database
`bengkel_e2e_laravel` yang sudah dimigrasi, dan `composer install` di `backend-laravel/`.
`node_modules` di `web/` dan `tests/wa-palsu/` dipakai bila ada; bila tidak, harness memasangnya
sendiri dengan `npm ci` dari lockfile folder itu ke `.bangun/deps/`, tanpa menulis apa pun ke
folder aslinya.

Database E2E dibuat sekali, seperti database uji lain (lihat "Database lain untuk percobaan" di
`docs/menjalankan.md`):

```sh
docker compose exec -T mysql mysql -uroot -proot -e \
  "CREATE DATABASE IF NOT EXISTS bengkel_e2e_laravel CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   GRANT ALL PRIVILEGES ON bengkel_e2e_laravel.* TO 'bengkel'@'%';"
MSYS_NO_PATHCONV=1 docker compose run --rm --entrypoint migrate migrate-uji \
  -path=/migrations "-database=mysql://bengkel:bengkel@tcp(mysql:3306)/bengkel_e2e_laravel?multiStatements=true" up
```

```sh
cd tests/e2e
npm ci
npm run e2e -- --backend=laravel                 # argumen lain diteruskan ke Playwright
npm run e2e -- --backend=laravel --headed --project=spk
npm run typecheck
```

`--project=<nama>` menjalankan satu skenario beserta skenario yang mendahuluinya (lihat tabel di
bawah), karena tiap skenario memakai data yang dibuat skenario sebelumnya.

| Backend | Backend | WhatsApp palsu | Web | Database |
|---|---|---|---|---|
| Laravel | 8812 | 8815 | 3812 | `bengkel_e2e_laravel` |
| Go (menyusul) | 8811 | 8814 | 3811 | `bengkel_e2e_go` |
| NestJS (menyusul) | 8813 | 8816 | 3813 | `bengkel_e2e_nestjs` |

Port dan database Go dan NestJS sudah dicadangkan di `src/backend.ts`. Saat backend itu ada,
cukup tambahkan cara build dan menyalakannya di `bangunBackend()` (`src/bangun.ts`); tes, data, dan
harness lainnya tidak berubah. Beberapa backend bisa diuji bersamaan karena port dan databasenya
terpisah.

## Cara layanan dinyalakan

- **Backend Laravel:** `php artisan bengkel:serve` dari folder `backend-laravel/` dengan env E2E di
  baris perintah (`PORT`, `DATABASE_URL`, `WA_API_URL`, `WA_TOKEN`, `SETUP_TOKEN`,
  `PUBLIC_WEB_URL`), yang selalu menang atas `.env`. Server bawaan PHP ini melayani satu
  permintaan sekaligus. Itu cukup untuk E2E: satu browser dengan satu worker, dan WhatsApp palsu
  membalas seketika, jadi tidak ada permintaan yang menahan permintaan lain. Keserentakan
  (nomor SPK, stok terakhir) dibuktikan tes kontrak di Nginx + php-cgi, bukan di sini.
- **WhatsApp palsu:** `tests/wa-palsu` dengan token uji yang sama dengan backend; harness
  menunggu `/__kendali/ping` membalas sidik token yang benar sebelum lanjut.
- **Web:** salinan `web/` di `.bangun/sumber/web-<backend>` dibuild dengan `next build` lalu
  dijalankan `next start` dengan `API_URL` menunjuk backend E2E. Karena build dibuat di salinan,
  `.next` milik `npm run dev` di `web/` tidak pernah tersentuh dan `web/next.config.ts` tidak perlu
  diubah. Build dipakai ulang selama sumber `web/` tidak berubah (dicek dengan sidik isi berkas).

`PUBLIC_WEB_URL` backend sama dengan alamat web E2E, jadi tautan lacak di pesan WhatsApp bisa
dibuka langsung oleh tes. Port yang sudah dipakai proses lain membuat harness berhenti tanpa
mematikan proses itu.

## Skenario

Berjalan berurutan (satu worker). Nomor booking dan SPK bergantung pada urutan ini.

| Project | Berkas | Isi |
|---|---|---|
| `pemasangan` | `01-pemasangan.spec.ts` | server kosong membuka halaman pemasangan → pemilik pertama → profil outlet → tiga jasa (tampil di website, disembunyikan, nonaktif) → dua sparepart dengan stok awal dan harga beli → akun kasir dan dua mekanik, masing-masing masuk |
| `booking` | `02-booking-publik.spec.ts` | pelanggan membuka `/` di HP dan hanya melihat jasa publik yang aktif, booking tanpa akun (B-0001, tanpa WhatsApp) → halaman status Menunggu (HP tersamar) → kasir mengonfirmasi → WhatsApp konfirmasi tiba (dibandingkan huruf demi huruf) → kasir menjadikan SPK S-0001 dengan mekanik → WhatsApp "SPK dibuat" membawa tautan lacak |
| `spk` | `03-spk.spec.ts` | kasir menambah jasa yang disembunyikan dari website dengan harga khusus (jasa nonaktif tidak bisa dipilih) dan part (stok berkurang; kasir tidak menerima `costPrice`), part melebihi stok ditolak dengan pesan baku, SPK pelanggan datang langsung S-0002 untuk mekanik lain, mekanik hanya melihat SPK miliknya (halaman dialihkan, API 403), mekanik Dikerjakan → Menunggu part → Dikerjakan → Selesai, WhatsApp siap diambil tiba, pelanggan membuka tautan lacak dan melihat total, Diambil ditolak sebelum lunas (tombol terkunci dan API 409), bayar sebagian (tunai, kembalian) lalu lunas (QRIS), Diambil, linimasa, dan rekap pemilik cocok dengan hitungan ulang di tes (nilai, modal, laba kotor, per metode, terlaris) |
| `penolakan` | `04-penolakan-dan-batal.spec.ts` | kasir menolak booking dengan alasan (B-0002), WhatsApp penolakan tiba, pelanggan melihat alasannya; pelanggan membatalkan booking sendiri (B-0003), tanpa WhatsApp, dan kasir tidak bisa mengonfirmasinya |
| `batal-spk` | `05-batal-spk.spec.ts` | S-0002 diberi part sampai stok habis lalu dibatalkan dengan alasan → stok kembali, kartu stok mencatat "Dikembalikan dari SPK", SPK batal tidak bisa dibayar, pelanggan melihat alasannya di halaman lacak |
| `tautan-lacak` | `06-tautan-lacak.spec.ts` | buat ulang tautan lacak → tautan lama menampilkan "Tautan lacak tidak berlaku", tautan baru bekerja, nota WhatsApp membawa tautan baru dan tanpa harga beli |
| `akses` | `07-akses.spec.ts` | kasir dan mekanik tidak bisa membuka Rekap, Staf, Outlet, Jasa, Sparepart (menu tidak tampil, alamat dialihkan dengan penjelasan, API 403); mekanik juga tidak bisa membuka halaman kasir; tidak ada data liar yang tercipta |

Hitungan uang di tes (`03-spk.spec.ts`) ditulis ulang dari aturan di `docs/rancangan.md`, bukan
diimpor dari kode produk, supaya salah hitung di produk tertangkap.

## Di mana hasilnya

Semua yang dibuat harness ada di `.bangun/` (diabaikan git):

| Folder | Isi |
|---|---|
| `sumber/` | salinan `web/` dan `tests/wa-palsu/` tempat build dibuat dan dijalankan; `node_modules` salinan adalah junction ke `node_modules` asli atau ke `deps/` |
| `deps/` | `node_modules` yang dipasang harness sendiri bila folder aslinya belum punya |
| `log/` | log build dan log setiap layanan per backend; baca ini dulu bila layanan gagal menyala |
| `hasil/`, `laporan/` | jejak, tangkapan layar, dan laporan HTML Playwright per backend |
| `sesi/` | sesi browser pemilik, kasir, dan mekanik, serta data antarskenario (nomor SPK, tautan lacak) |

`.next` di `sumber/web-*` boleh dihapus kapan saja untuk menghemat disk; build berikutnya
membuatnya lagi.
