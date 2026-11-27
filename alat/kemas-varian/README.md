# Pengemas paket jualan

Membuat ZIP paket jualan Aplikasi Bengkel dan memeriksa isinya sebelum diunggah sebagai versi
produk di toko. Alat ini tidak ikut dijual (`alat/` ditolak pemeriksa). Polanya dipindahkan dari
pengemas kafe-resto: pemilihan berkas berbasis git, ZIP deterministik, pemeriksa isi paket,
dokumen untuk pembeli dibuat dari templat, dan `node:test`.

Saat ini ada satu paket:

| Paket | Isi | Nama ZIP |
|---|---|---|
| Laravel, web | backend Laravel + web Next.js + kontrak API + migration + WhatsApp palsu + empat panduan Word | `bengkel-laravel-web-<versi>.zip` |

Semua isi ZIP berada di satu folder bernama sama dengan ZIP-nya (`bengkel-laravel-web-0.1.0/`).
Rancangannya sudah memuat varian dan jenis paket (lihat "Menambah varian atau jenis paket").

Prasyarat: Node.js 20.17 ke atas dan git. Tanpa dependensi npm (hanya `node:` bawaan).

```sh
node alat/kemas-varian/kemas.mjs                         # dist/paket/bengkel-laravel-web-<VERSION>.zip
node alat/kemas-varian/kemas.mjs --versi=1.0.0           # versi lain dari berkas VERSION
node alat/kemas-varian/kemas.mjs --tanpa-panduan         # hanya tahap pengembangan, lihat tabel argumen

node alat/kemas-varian/periksa.mjs dist/paket/bengkel-laravel-web-0.1.0.zip   # periksa ZIP yang sudah jadi
node alat/kemas-varian/periksa.mjs hasil-ekstrak/bengkel-laravel-web-0.1.0    # atau folder hasil ekstrak
node alat/kemas-varian/verifikasi.mjs dist/paket/bengkel-laravel-web-0.1.0.zip  # verifikasi seperti di tangan pembeli

node --test "alat/kemas-varian/tes/*.test.mjs"           # tes alat ini
```

| Argumen | Arti |
|---|---|
| `--varian=laravel\|semua` | varian yang dikemas, bawaan semua varian yang tersedia (sekarang hanya `laravel`; `go` dan `nestjs` ditolak dengan pesan "belum ada di repo ini") |
| `--paket=web\|semua` | jenis paket, bawaan semua jenis yang tersedia (sekarang hanya `web`) |
| `--versi=x.y.z` | versi paket (pra-rilis seperti `1.0.0-rc.1` boleh). Bawaan: isi berkas `VERSION` (atau `VERSI`) di akar repo; bila tidak ada, `0.1.0`. Berkas yang ada tetapi isinya salah menghentikan pengemas |
| `--keluaran=<folder>` | folder hasil, bawaan `dist/paket/` di akar repo (sudah di-gitignore) |
| `--tanpa-panduan` | tidak mewajibkan empat panduan Word. **Hanya untuk tahap pengembangan**; pengemas dan pemeriksa mencetak peringatan, dan paket yang dijual tidak boleh dibuat dengan flag ini |
| `--brand-kit=<folder>` | folder gambar brand toko untuk pemeriksaan logo yang terbawa (lihat bawah) |
| `--gambar-ahws=<folder>` | folder gambar milik situs klien AHWS untuk pemeriksaan gambar yang terbawa (lihat bawah) |
| `--akar=<folder>` | repo git yang dikemas, bawaan repo tempat alat ini berada. Dipakai tes (repo git sementara) |

Hasil: jumlah berkas, ukuran ZIP, sha256, rincian isi per folder teratas, dan jumlah berkas yang
sengaja ditinggal beserta alasannya. **Paket yang gagal diperiksa tidak ditulis**, galatnya dicetak
(berkas dan nomor barisnya), dan ZIP lama bernama sama dihapus supaya tidak tertukar. Kode keluar:
0 semua lolos, 1 ada yang gagal, 2 argumen salah.

## Cara berkas dipilih

- **Berbasis git, tanpa commit.** Daftar berkas dari `git ls-files --cached --others --exclude-standard`:
  yang dilacak ditambah yang belum dilacak tetapi tidak diabaikan `.gitignore`. Jadi paket bisa
  dibuat dari working tree yang belum pernah di-commit, sementara `node_modules`, `vendor`, `.next`,
  `.env`, dan sebangsanya tidak pernah ikut. Alat ini hanya **membaca** git (`ls-files`,
  `status`, `rev-parse`); tidak ada `git add`, `commit`, `stash`, atau `checkout`.
- **Pengaman kedua** bila ada yang terlanjur dilacak git: segmen `node_modules`, `vendor`, `dist`,
  `build`, `.next`, `.bangun`, `coverage`, `.git`, `.claude`, dan sejenisnya di kedalaman mana pun;
  `bin/` dan `uploads*/` di bawah folder backend; berkas rahasia (`.env*` selain `.env.example`,
  `*.pem`, `*.key`, keystore); sisa build (`*.log`, `*.exe`, `*.tsbuildinfo`, `.DS_Store`).
- **Akhir baris** teks dijadikan LF (git di Windows dengan `core.autocrlf=true` menulis CRLF ke
  working tree dan skrip shell ber-CRLF gagal di Linux).

| Ikut | Tidak ikut |
|---|---|
| `backend-laravel/` | `tests/kontrak/`, `tests/e2e/`, `alat/`, `dist/` |
| `web/` | `docs/eksekusi/`, `docs/rancangan.md` (catatan internal) |
| `spec/` | `spec/redocly.yaml` (konfigurasi lint dari `tests/kontrak`) |
| `db/migrations/`, `db/tanpa-docker.sql`, `db/init/` (pembuat database dari templat) | database uji backend lain di `db/init` (berkas repo diganti templat) |
| `docs/menjalankan.md` (dari templat), `docs/panduan/*.docx` (empat panduan Word) | `backend-*/scripts/uji-kontrak*` dan `uji-serentak*` (hanya jalan bersama `tests/kontrak`) |
| `tests/wa-palsu/` (WhatsApp palsu untuk dev) | `.env*` kecuali `.env.example`, dependensi, hasil build |
| `docker-compose.yml`, `.gitignore`, README paket (dari templat) | runner `migrate-uji*` di compose (compose repo diganti templat) |
| `LICENSE`, `VERSION` (dibuat dari versi paket) | `backend-go/`, `backend-nestjs/`, `mobile/` (bila kelak ada di repo) |

**Keputusan: `spec/` ikut.** Kontrak API adalah dokumentasi yang dibutuhkan pembeli, README backend
menautkannya, dan web berbicara hanya lewat kontrak itu. Isinya harus ditulis netral (tanpa "tes
kontrak", nama backend lain, produk lain, atau catatan tahap pengerjaan). Pengemas **tidak menulis
ulang** dokumen milik bagian lain dengan penggantian teks; pemeriksa menolaknya sampai pemiliknya
memperbaiki sumbernya. Pengecualian yang disengaja ada di bagian berikut.

## Dokumen yang diubah saat pengemasan

Berkas ini **tidak pernah disalin dari repo**, karena versi repo ditulis untuk pengembang:

| Berkas paket | Templat | Mengapa |
|---|---|---|
| `README.md` | `README.md` | merujuk hanya hal yang ada di paket: cara mencoba di laptop, Fonnte, dan syarat sebelum dipakai publik |
| `docs/menjalankan.md` | `menjalankan.md` | versi repo memuat lint dan tes kontrak, `migrate-uji*`, port uji dan E2E, dan backend lain |
| `docker-compose.yml` | `docker-compose.yml` | hanya MySQL dev dan `migrate-dev`; tanpa `migrate-uji*` |
| `db/init/01-buat-database.sql` | `buat-database.sql` | hanya database `bengkel`, tanpa database tes kontrak |
| `.gitignore` | `gitignore` | tanpa folder backend lain, `tests/kontrak`, dan `.bangun/` E2E |
| `VERSION` | (dibuat) | berisi versi paket, jadi selalu sama dengan nama ZIP |

Templat memakai isian `{{nama}}`, `{{versi}}`, `{{folder}}`, `{{port}}`, `{{siapkan}}`, `{{mulai}}`,
`{{migrasi}}`, dan lain-lain (lihat `nilaiTemplat` di `lib/ubah.mjs`) serta blok bersyarat
`{{#laravel}} ... {{/laravel}}` (varian itu saja), `{{^laravel}} ... {{/laravel}}` (bukan varian
itu), dan `{{#mobile}} ... {{/mobile}}` untuk paket dengan aplikasi staf kelak. Penanda blok
berdiri sendiri di satu baris. Salah ketik, blok yang tidak ditutup, atau isian yang tidak diisi
menghentikan pengemas.

Perubahan atas berkas repo hanya tiga jenis:

1. **Port.** `API_URL` di `web/.env.example` dan entri `servers` di `spec/openapi.yaml` (satu
   entri netral `http://localhost:8802` di repo) diganti ke port backend varian. Di paket Laravel
   nilainya tetap, tetapi bentuk barisnya tetap diperiksa: tepat satu entri
   `- url: http://localhost:<port>` di spec; nol atau lebih dari satu menghentikan pengemas.
2. **Akhir baris** CRLF menjadi LF.
3. **Blok bertanda `kemas:abaikan`.** Bagian yang berguna bagi pengembang tetapi tidak untuk pembeli
   (cara menjalankan tes kontrak, skrip `uji-kontrak.sh` dan `uji-serentak.sh`, runner
   `migrate-uji-laravel`) dibungkus penanda oleh penulisnya dan dibuang beserta penandanya. Dengan
   cara inilah README backend di paket tidak merujuk tes kontrak, E2E, atau runner uji:

   | Jenis berkas | Pembuka | Penutup |
   |---|---|---|
   | `.md` | `<!-- kemas:abaikan-mulai -->` | `<!-- kemas:abaikan-selesai -->` |
   | `.env.example`, `.gitignore` | `# kemas:abaikan-mulai` | `# kemas:abaikan-selesai` |

   Penanda berdiri sendiri di satu baris. Pengemas **berhenti** (galat dengan berkas dan nomor
   baris) bila penanda tidak berpasangan, bersarang, tidak sendirian di barisnya, atau muncul di
   jenis berkas lain (mis. komentar `.php` atau `.ts`); pemeriksa menolak penanda yang masih
   tersisa di ZIP. Daftar isi dan tautan anchor harus tetap benar sesudah blok hilang: entri daftar
   isi untuk bagian yang dibuang ikut dibungkus penanda, dan pemeriksa tautan menolak anchor yang
   tertinggal.

**Menjaga templat tidak tertinggal.** `templat/docker-compose.yml` adalah salinan ramping dari
compose repo. Setiap kali mengemas, `image` dan port layanan `mysql` dan `migrate-dev` dibandingkan
dengan compose repo; bila beda (mis. digest MySQL dinaikkan), pengemas berhenti dan meminta templat
disinkronkan. Isi `templat/menjalankan.md` adalah ringkasan `docs/menjalankan.md` repo dan README
backend: bila bagian fondasi (migration, WhatsApp palsu, syarat produksi) berubah di sana,
sesuaikan templatnya juga.

## ZIP deterministik

Dua kali bangun dari isi yang sama menghasilkan **byte yang sama** (sha256 sama), walau dibangun di
hari lain, di folder lain, atau dengan waktu ubah berkas yang berbeda:

- urutan berkas tetap (diurutkan menurut nama, bukan urutan sistem berkas atau git);
- cap waktu semua berkas tetap, 2026-01-01 00:00 UTC (`SOURCE_DATE_EPOCH` boleh menggantinya);
- izin tetap: `0644`, kecuali `*.sh` dan `artisan` yang `0755`. Izin ditentukan dari nama berkas,
  bukan dari mode di mesin pembangun (Windows tidak punya bit eksekusi);
- tanpa ZIP64, tanpa komentar ZIP, UTF-8 untuk nama berkas. ZIP dibaca ulang dengan aturan unggah
  toko (maksimum 65.534 berkas, CRC cocok).

Watermark pembeli ditambahkan toko saat unduhan, bukan di sini.

## Aturan pemeriksa

`periksa.mjs` (dan pemeriksaan otomatis di `kemas.mjs`) gagal bila ada satu pun dari ini. Aturannya
ada di `lib/aturan.mjs`, logikanya di `lib/periksa.mjs`.

| Pelanggaran | Catatan |
|---|---|
| berkas di luar folder `bengkel-<varian>-web-<versi>/`, nama berkas ganda atau tidak aman | folder akar harus cocok dengan varian, jenis, dan versi |
| berkas terlarang | `tests/kontrak/`, `tests/e2e/`, `alat/`, `dist/`, `docs/eksekusi/`, `docs/rancangan.md`, `spec/redocly.yaml`, `.git/`, `.claude/`, `.impeccable/`, `.playwright-mcp/`, folder backend lain (`backend-go/`, `backend-nestjs/`), skrip `uji-kontrak*` dan `uji-serentak*` |
| apa pun di `mobile/` | paket web tidak memuat aplikasi staf; satu galat per berkas |
| hasil build atau data runtime | `node_modules`, `vendor`, `dist`, `build`, `.next`, `.bangun`, ..., `bin/` dan `uploads*/` di backend; `*.log`, `*.exe`, `*.tsbuildinfo`, `.DS_Store` |
| berkas rahasia | `.env` dan variannya selain `.env.example`, `*.pem`, `*.key`, keystore |
| rahasia di dalam teks | kunci privat, kunci AWS/Google/GitHub/Slack/Stripe, URL berkredensial ke host sungguhan; di `.env.example`, `.md`, `.sh`, `.yml`, nilai env bernama `*TOKEN/SECRET/KEY/PASSWORD/SANDI` harus kosong, `<placeholder>`, substitusi perintah, atau bertanda contoh (`bukan`, `contoh`, `uji`, `palsu`, `laptop`, `example`); `SETUP_TOKEN` di `.env.example` wajib kosong |
| rujukan teks ke hal yang tidak dikemas | `tests/kontrak`, `tests/e2e`, `alat/`, `docs/eksekusi/`, `rancangan.md`, perintah tes kontrak (`cek-harness`, `lint-spec`, `bundel-spec`, `BASE_URL=`), `migrate-uji`, `.spec-bundel`, `uji-kontrak`, `uji-serentak`, penanda tahap pengerjaan ("tahap A", "Bagian 0a"), produk lain penjual (laundry, toko online, kafe-resto, SIAKAD), dan penanda `kemas:abaikan` yang tidak terbuang. Berlaku di semua berkas teks, termasuk komentar kode, kecuali berkas kunci dependensi |
| rujukan khusus dokumen | di `.md`, `.yml/.yaml`, `.env.example`, `.gitignore`: database `bengkel_uji*`, `bengkel_e2e*`, `bengkel_review*`, frasa "ketiga/tiga/kedua backend", "tes kontrak", "harness", nama backend lain (Go, NestJS), port backend lain (`:8801`, `:8803`), dan kata aplikasi staf (`cd mobile`, `mobile/`, Flutter, `dart-define`, `10.0.2.2`, APK, emulator, Play Store, App Store; juga di kode) |
| backend lain | token folder `backend-go` atau `backend-nestjs` di teks apa pun, termasuk komentar kode |
| **AHWS** | kata AHWS (situs klien, proyek terpisah) di **semua** berkas termasuk LICENSE, README, dan teks panduan Word; nama berkas yang memuat "ahws"; isi biner (metadata gambar, teks di SVG); gambar di dalam panduan Word; dan, bila `--gambar-ahws` diberikan, berkas atau gambar panduan yang sama persis dengan gambar di folder itu |
| nama brand toko di luar `LICENSE`, README akar, header, dan panduan Word | alamat email pemegang hak cipta di header dikecualikan. Panduan Word boleh memuat nama dan logo toko di sampul dan kaki halaman, seperti panduan produk lain penjual (`MEREK_BOLEH_DI_PANDUAN` di `lib/aturan.mjs`, `true` sejak keputusan koordinator 2026-11-27; `false` membuat teks dan gambar brand di panduan ditolak lagi). Logo brand kit di luar panduan tetap ditolak |
| gambar yang sama persis dengan gambar brand kit | opsional, lihat bawah |
| berkas kode tanpa header hak cipta dua baris | `.php .ts .tsx .js .mjs .css .sql .sh .yml .yaml .xml`, `artisan`, `.env.example`. Dikecualikan: JSON, lockfile, gambar, SVG, Markdown, dan konfigurasi titik (`.npmrc`, `.prettierrc`, `.gitignore`). Boleh didahului shebang, `<?php`, atau `<?xml` |
| akhir baris CRLF di berkas teks | kecuali `.bat` dan `.cmd` |
| berkas lebih dari 5 MB | `BERKAS_BESAR_SAH` di `lib/aturan.mjs` untuk pengecualian yang sah |
| jalur absolut mesin pengembang | `D:\KODE_PRODUK`, `C:\Users`, `D:/KODE_PRODUK`, `/d/KODE_PRODUK`, `/Users/<nama>` |
| tanpa `LICENSE` (atau terlalu pendek) | |
| tanpa empat panduan Word | `docs/panduan/Panduan-Pemakai-Aplikasi-Bengkel.docx`, `Panduan-Menjalankan-di-Laptop.docx`, `Panduan-Upload-ke-VPS.docx`, `Panduan-Arsitektur-dan-Teknologi.docx`; harus `.docx` yang bisa dibuka, teksnya tidak boleh merujuk hal internal, dan tidak boleh ada berkas lain di `docs/panduan/` |
| tautan atau rujukan relatif yang rusak | tautan Markdown relatif (beserta anchor judulnya) di semua `.md`, dan jalur dalam tanda kutip balik di README akar dan `docs/`. Jalur yang dibuat pembeli (`.env.local`, `node_modules`, ...) dikecualikan |
| paket tidak bisa langsung dijalankan | `PORT`, `WA_API_URL`, `WA_TOKEN`, `DATABASE_URL`, `PUBLIC_WEB_URL` di `.env.example` backend harus cocok dengan port varian, WhatsApp palsu (`TOKEN_BAWAAN`), compose, dan web dev (3800); `API_URL` web dan `servers` di `spec/openapi.yaml` = port backend; port bawaan WhatsApp palsu (`tests/wa-palsu/src/main.ts` dan `.env.example`) = 8890; compose punya `mysql` dan `migrate-dev` tanpa `migrate-uji*`; `db/init` hanya membuat database `bengkel`; `VERSION` = versi di nama paket |
| berkas wajib hilang | README, `LICENSE`, `.gitignore`, `VERSION`, compose, README dan `.env.example` backend, `composer.json`, `web/package.json`, `web/package-lock.json`, `web/.env.example`, `web/README.md`, `spec/openapi.yaml`, `spec/whatsapp.md`, `db/migrations/`, `db/init`, `docs/menjalankan.md`, `tests/wa-palsu/` |

**README akar** boleh menyebut *nama* varian lain dan frasa "tiga backend" sebagai pilihan produk;
folder dan portnya tetap dilarang. Di komentar kode, nama varian lain (bukan folder) tidak
diperiksa karena tidak menyuruh pembeli melakukan apa pun.

**Brand kit dan gambar AHWS (opsional).** Berkas yang isinya sama persis dengan salah satu gambar
di folder ini ditolak, juga gambar di dalam panduan Word. Brand kit diambil dari `--brand-kit`,
lalu env `KEMAS_BRAND_KIT`, lalu `D:/KODE_BELAJAR/kodecoding-brand-kit`; folder bawaan yang tidak
ada membuat pemeriksaan ini dilewati (dengan pesan). Gambar AHWS diambil dari `--gambar-ahws` atau
env `KEMAS_GAMBAR_AHWS` dan **tidak punya lokasi bawaan**, karena proyek klien itu tidak boleh
disentuh tanpa diminta; tanpanya, nama dan teks AHWS tetap ditolak. Folder yang disebut eksplisit
tetapi tidak ada menghentikan alat.

## Verifikasi hasil ekstrak

`verifikasi.mjs` meniru pembeli: ZIP dibaca Python `zipfile` (CRC semua berkas, tanpa nama ganda),
diekstrak ke folder sementara di luar repo, lalu dari hasil ekstrak dijalankan `composer install`
dan `composer test` (tes unit backend), `npm ci`, `npm run typecheck`, `npm test`, dan
`npm run build` di `web/`, serta `npm ci`, `npm run typecheck`, dan `npm test` di
`tests/wa-palsu/`. Dependensi dipasang dari lockfile di dalam paket, jadi lockfile yang tertinggal
atau berkas yang lupa ikut langsung ketahuan. Butuh Python 3, PHP 8.4 + Composer 2, dan Node.js.
Folder ekstrak dihapus bila semua lolos (`--simpan` membiarkannya, `--folder` menentukan
tempatnya).

## Menambah varian atau jenis paket

- **Varian Go atau NestJS:** lengkapi barisnya di `VARIAN` (`lib/aturan.mjs`): `tersedia: true`,
  `manifes`, `prasyarat`, `siapkan`, `mulai`, `migrasi`, `uji`. Tambahkan blok `{{#go}}` atau
  `{{#nestjs}}` di templat bila ada langkah khusus, dan perintah tes unitnya di `verifikasi.mjs`.
  Aturan "backend lain" (nama, folder, port) sudah berlaku untuk semua baris `VARIAN`.
- **Paket `-web-mobile`:** tambahkan baris `JENIS` dengan `mobile: true` dan
  `akhiran: '-web-mobile'`. `akarVarian` lalu ikut membawa `mobile/`, dan pemeriksa tidak lagi
  menolak kata aplikasi staf di paket itu. Tambahkan berkas inti `mobile/` ke `wajibAda` dan blok
  `{{#mobile}}` di templat (lihat pengemas kafe-resto untuk contoh lengkapnya, termasuk penggantian
  alamat bawaan backend di aplikasi).

## Mengubah alat ini

- Aturan isi paket, varian, jenis, nama paket, rujukan terlarang, pola rahasia, header, brand,
  AHWS, dan panduan: `lib/aturan.mjs`.
- Logika pemeriksaan: `lib/periksa.mjs`. Pemilihan berkas dan versi: `lib/pilih.mjs`. Templat,
  port web dan spec, EOL, blok `kemas:abaikan`, sinkron compose: `lib/ubah.mjs`. ZIP:
  `lib/zip.mjs`. Pembangun satu paket di memori: `lib/bangun.mjs`. Membaca ZIP atau folder untuk
  diperiksa: `lib/baca.mjs`. Argumen: `lib/argumen.mjs`. Gambar terlarang: `lib/merek.mjs`.
- Tes (`node:test`): `tes/*.test.mjs`. `tes/periksa.test.mjs` punya satu tes per jenis
  pelanggaran dan memastikan satu pelanggaran tidak memicu galat lain. `tes/kemas.test.mjs`
  membangun paket dari repo git sementara (bukan repo ini) lewat fungsi dan lewat `kemas.mjs` dan
  `periksa.mjs` sebagai proses sungguhan. Tidak ada tes yang menyentuh repo ini.
- Jangan melonggarkan pemeriksa agar paket lolos; perbaiki sumbernya, atau (bila aturannya memang
  keliru) ubah aturannya beserta tesnya.
