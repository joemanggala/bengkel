# Rancangan Aplikasi Bengkel

Tanggal: 2026-11-27 · Status: rancangan, menunggu tinjauan pengguna.

Produk berikutnya di KodeCoding (setelah Laundry, Toko Online, Kafe dan Resto, dan SIAKAD).
Pembeli mendapat source code lengkap satu varian: backend + web Next.js. Isinya: website publik
bengkel dan aplikasi pengelolaan bengkel motor dan mobil untuk satu outlet, dari pelanggan
booking lewat website atau datang langsung sampai kendaraan selesai diservis, dibayar, dan
diambil. Pola, struktur repo, dan konvensi kode mengikuti `D:\KODE_PRODUK\laundry` (kasir,
status, pembayaran dicatat kasir, WhatsApp) dan `D:\KODE_PRODUK\kafe-resto` (halaman publik
tanpa akun dengan token, harga beli khusus pemilik, kartu stok yang berkurang otomatis dan
kembali saat batal).

## Keputusan pengguna (2026-11-27)

- **Produk: website bengkel + aplikasi bengkel**, di repo git sendiri
  (`D:\KODE_PRODUK\bengkel`), mengikuti model produk lain di `D:\KODE_PRODUK`.
- **Varian pertama: backend Laravel + web Next.js.** Berbeda dengan produk lain yang memulai dari
  Go, karena pengguna memilih Laravel lebih dulu. Backend Go dan NestJS menyusul dengan kontrak
  API yang sama, jadi spec dan tes kontrak tetap ditulis untuk tiga backend sejak awal.
- **Web dulu, tanpa mobile.** Aplikasi Flutter menyusul sebagai paket `-web-mobile`, seperti
  kafe-resto.
- **Satu outlet.**
- **Empat fitur inti wajib ada:**
  1. website publik bengkel dengan booking online yang masuk ke sistem;
  2. SPK (surat perintah kerja) servis dengan status dan pesan WhatsApp ke pelanggan;
  3. kasir, nota, dan stok sparepart;
  4. pelanggan, kendaraan beserta riwayat servisnya, dan rekap.
- **Desain dan pola lainnya sama dengan produk KodeCoding.** Panel staf dan halaman publik
  memakai sistem tampilan yang sama dengan `kafe-resto/web` dan `laundry/web` (yang meniru admin
  KodeCoding): tema terang yang tenang, satu warna utama, semua warna sebagai token di
  `globals.css` dengan tes kontras WCAG AA, sidebar lipat, kolom No, baris per halaman, dan pita
  judul halaman yang ramping. Bukan gaya gelap situs bengkel performa. Identitas tetap netral
  (nama, kontak, dan jam buka dari profil outlet; bawaan "Nama Bengkel").
- **Repo GitHub:** `https://github.com/joemanggala/bengkel`, cabang `main`.
- **Situs AHWS Racing Team** (proyek klien pengguna, `D:\KODE_PRODUK\ahws-racing`) **terpisah**
  dari produk ini: tidak dijadikan acuan, tidak disalin, dan tidak ikut paket jualan.

## Keputusan yang saya ambil sendiri

Menunggu persetujuan pengguna. Nomor dipertahankan supaya rujukan tidak bergeser bila ada yang
dibuang.

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Tiga peran staf: **pemilik**, **kasir**, **mekanik** | Mekanik perlu melihat pekerjaannya dan menandai progres. Tanpa peran mekanik, kasir harus menanyakan dan mengubah status untuk setiap motor |
| 2 | Mekanik **hanya melihat SPK yang ditugaskan kepadanya**, hanya bisa mengubah status antara Dikerjakan, Menunggu part, dan Selesai, serta mengisi diagnosis. Item jasa/part, pembayaran, dan pembatalan tetap di kasir | Uang dan stok hanya disentuh peran yang bertanggung jawab atas kas. Mekanik melaporkan part yang dibutuhkan ke kasir |
| 3 | Pelanggan **tanpa akun dan tanpa OTP**. Dua token publik: `bookingToken` (satu booking) dan `trackingToken` (satu SPK) | Sama dengan kafe-resto. Booking dan lacak servis harus semudah membuka tautan |
| 4 | Booking dari website mulai `PENDING` dan **harus diterima staf**; paling banyak **3 booking menunggu per nomor HP**; tanggal datang hari ini sampai 30 hari ke depan | Form publik bisa diisi siapa saja. Penerimaan staf adalah pengaman utama; batas 3 menahan banjir booking palsu. Rate limit per IP tetap wajib di proxy |
| 5 | **Tidak ada WhatsApp yang dikirim otomatis dari form publik.** Pesan pertama ke pelanggan dikirim saat staf mengonfirmasi atau menolak booking | Sama dengan kafe-resto: nomor di form publik bisa nomor orang lain, jadi kirim otomatis bisa dipakai untuk spam |
| 6 | Status SPK **tidak sekadar maju satu langkah**: Dikerjakan dan Menunggu part boleh bolak-balik (lihat "Status SPK") | Di bengkel, pekerjaan sering berhenti menunggu part lalu dilanjutkan lagi |
| 7 | Sparepart **berkurang saat ditambahkan ke SPK**, bukan saat SPK selesai; kembali bila item dihapus atau SPK dibatalkan; stok kurang ditolak (409 `insufficient_stock`) | Part sudah keluar dari rak begitu dipasang. Stok di layar harus sama dengan isi rak sepanjang hari |
| 8 | **Harga beli sparepart hanya terlihat pemilik** (`costPrice` tidak ada sama sekali di respons untuk kasir dan mekanik), disalin ke item SPK, dipakai rekap laba kotor | Sama dengan kafe-resto |
| 9 | Nomor SPK `S-0001` dan booking `B-0001` **berurutan terus**, tidak direset per hari | Sama dengan laundry dan kafe-resto |
| 10 | Plat nomor dinormalisasi: pencarian dan keunikan memakai huruf besar tanpa spasi (`B1234XYZ`), tampilan dirapikan (`B 1234 XYZ`). Satu plat hanya milik satu pelanggan | Kasir mengetik plat dalam berbagai bentuk; tanpa normalisasi satu motor bisa tercatat dua kali |
| 11 | **Tanpa diskon** di MVP | Sama dengan laundry dan kafe-resto. Diskon menambah aturan hitung dan izin; kandidat pertama pembaruan |
| 12 | SPK **tidak bisa dibatalkan bila sudah ada pembayaran**; tidak ada void/refund | Sama dengan laundry dan kafe-resto |
| 13 | Isi halaman depan selain data outlet dan daftar jasa (langkah booking dan FAQ) ada di **satu berkas konten di `web/`**, bukan di database | Jarang diubah. Pembeli mengedit satu berkas, tanpa membuat CMS |
| 16 | Warna utama bengkel **biru tua** (token `--color-utama`, nilai pasti diusulkan Bagian 2 dan lolos tes kontras); warna lain hanya untuk makna status, seperti kafe-resto | Tiap produk punya satu warna utama sendiri (kafe-resto cokelat espreso). Biru tua umum dipakai bengkel dan mudah diganti pembeli lewat satu token |
| 14 | Halaman lacak `/servis/{trackingToken}` **juga berfungsi sebagai nota online** (rincian item, total, terbayar, sisa) | Satu tautan WhatsApp untuk pelanggan, bukan dua |
| 15 | Daftar pekerjaan dan halaman lacak **memuat ulang berkala** (polling), tanpa WebSocket/SSE | Sama dengan kafe-resto |

## Peran

| Peran | Lewat | Bisa |
|---|---|---|
| Pemilik | web | semua yang bisa kasir, ditambah kelola jasa, sparepart (termasuk harga beli) dan stok, akun staf, profil outlet, dan rekap harian beserta laba kotornya |
| Kasir | web | terima, tolak, dan jadikan SPK booking; buat SPK; kelola pelanggan dan kendaraan; tugaskan mekanik; tambah dan hapus item jasa/part; ubah status; catat pembayaran; batalkan; kirim WhatsApp; cetak nota |
| Mekanik | web | lihat SPK yang ditugaskan kepadanya, ubah status (Dikerjakan / Menunggu part / Selesai), isi diagnosis |
| Pelanggan | website, tanpa masuk | lihat profil bengkel dan daftar jasa, booking, lihat dan batalkan booking selagi menunggu, lacak servis dan lihat nota |

Akun pemilik pertama dibuat lewat halaman setup sekali pakai (`POST /api/setup`), persis seperti
produk lain. Pemilik membuat akun kasir dan mekanik dari web. Pelanggan tidak punya akun.

## Alur utama

**Pelanggan datang langsung**

1. Kasir mencari kendaraan dari plat atau pelanggan dari nomor HP, atau menambahkannya.
2. Kasir membuat SPK: keluhan, odometer (opsional), estimasi selesai (opsional), mekanik
   (opsional, bisa ditugaskan nanti). SPK bernomor `S-0001`, status **Antre**. Pelanggan
   dikirimi WhatsApp berisi nomor SPK dan tautan lacak.
3. Kasir menambahkan item jasa dan sparepart kapan saja selama SPK belum selesai. Stok part
   langsung berkurang. Total dihitung backend.
4. Mekanik menandai **Dikerjakan**, bisa berpindah ke **Menunggu part** dan kembali, lalu
   **Selesai**. Saat Selesai, pelanggan otomatis dikirimi WhatsApp "kendaraan siap diambil"
   beserta total dan tautan nota.
5. Pembayaran bisa dicatat kapan saja sejak SPK dibuat (uang muka), boleh dicicil. Kendaraan
   hanya bisa diserahkan (**Diambil**) setelah lunas.

**Booking lewat website**

1. Pelanggan membuka `/booking`, mengisi nama, nomor WhatsApp, jenis kendaraan, plat,
   merek/tipe, jasa (opsional), tanggal datang, dan keluhan. Booking bernomor `B-0001`,
   status **Menunggu**, dan pelanggan diarahkan ke `/booking/{bookingToken}` (token hanya
   dikirim sekali; tautannya disimpan di browser). Pelanggan bisa membatalkan selagi menunggu.
2. Kasir melihat booking masuk, lalu **mengonfirmasi** (pelanggan dikirimi WhatsApp) atau
   **menolak** dengan alasan (pelanggan dikirimi WhatsApp berisi alasannya).
3. Saat pelanggan datang, kasir **menjadikan SPK**: pelanggan dicari dari nomor HP dan
   kendaraan dari plat (dibuat bila belum ada), jasa yang dipilih menjadi item pertama, dan
   booking berstatus **Jadi SPK**. Booking yang masih menunggu juga bisa langsung dijadikan SPK
   bila pelanggan datang sebelum dikonfirmasi.
4. Selanjutnya sama dengan pelanggan yang datang langsung.

## Status SPK

`QUEUED` Antre → `IN_PROGRESS` Dikerjakan ⇄ `WAITING_PARTS` Menunggu part;
`IN_PROGRESS` → `DONE` Selesai → `PICKED_UP` Diambil. Ditambah `CANCELLED` Dibatalkan.

- Perpindahan yang sah hanya yang tertulis di atas. Selain itu ditolak (409
  `status_transition_invalid`).
- `PICKED_UP` hanya bila lunas (409 `not_paid_off`).
- Pembatalan hanya dari `QUEUED`, `IN_PROGRESS`, atau `WAITING_PARTS`, wajib alasan, dan hanya
  bila belum ada pembayaran (409 `has_payments`). Semua part di SPK kembali ke stok.
- Item hanya bisa ditambah atau dihapus selama `QUEUED`, `IN_PROGRESS`, atau `WAITING_PARTS`
  (409 `work_order_locked`).
- Mekanik hanya boleh ke `IN_PROGRESS`, `WAITING_PARTS`, atau `DONE`, dan hanya untuk SPK
  miliknya (403 `forbidden`).
- Setiap perubahan dicatat (status lama, baru, staf, catatan, kapan) sebagai linimasa.

## Status booking

`PENDING` Menunggu → `CONFIRMED` Dikonfirmasi → `CONVERTED` Jadi SPK. Ditambah `REJECTED`
Ditolak (staf, wajib alasan) dan `CANCELLED` Dibatalkan (pelanggan, hanya dari `PENDING`).
`PENDING` boleh langsung ke `CONVERTED`. Selain itu 409 `booking_transition_invalid`.

## Aturan bisnis

- **Uang** `BIGINT` rupiah bulat.
- **Subtotal item** = harga × jumlah (1–99 per item, paling banyak 50 item per SPK). Nama, harga
  jual, dan harga beli (part) disalin ke item, sehingga perubahan katalog tidak mengubah SPK
  lama maupun labanya. Jasa boleh diberi harga lain saat ditambahkan (mis. tambahan pekerjaan),
  part selalu harga jual katalog.
- **Total** = subtotal jasa + subtotal part.
- **Nomor SPK dan booking** berurutan untuk outlet, dibuat dalam transaksi dengan penguncian baris
  tabel penghitung supaya dua kasir tidak mendapat nomor yang sama.
- **Stok**: kartu stok mencatat setiap perubahan (`IN` masuk, `OUT` keluar manual, `COUNT`
  hitung ulang, `USED` terpakai SPK, `RETURNED` dikembalikan dari SPK) beserta stok sesudahnya.
  Stok tidak pernah negatif. Dua item part yang sama di satu SPK mengurangi stok dua kali.
  Penguncian baris part mencegah dua kasir memakai stok terakhir bersamaan.
- **Pembayaran** `cash` | `transfer` | `qris`, boleh beberapa kali, jumlahnya 1 sampai sisa
  tagihan (melebihi → 422), tidak bisa untuk SPK batal atau sudah diambil (409). Uang
  kembalian hanya dihitung di layar kasir. Status bayar turunan: `unpaid` | `partial` | `paid`.
- **Nomor HP** diterima `08…`, `+628…`, atau `628…` (boleh spasi dan tanda hubung), disimpan
  `628…`, panjang 10–15 digit. Nomor pelanggan unik (409 `phone_taken`).
- **Plat** unik setelah normalisasi (409 `plate_taken`). Menjadikan booking SPK dengan plat
  milik pelanggan lain ditolak (409 `plate_owned_by_other_customer`) supaya kasir memeriksanya.
- **Jasa dan part nonaktif** tidak bisa dipakai di item baru (422). Jasa dan part tidak pernah
  dihapus. Jasa bertanda `isPublic` tampil di website.
- **Pesan WhatsApp** (booking dikonfirmasi, booking ditolak, SPK dibuat, siap diambil, nota)
  dicatat beserta hasil kirimnya. Kegagalan kirim tidak membatalkan transaksi, dan kasir bisa
  mengirim ulang.
- **Rekap harian** memakai tanggal WIB (data disimpan dalam UTC): SPK masuk, SPK selesai dan
  diambil, nilai SPK (jasa dan part), uang diterima total dan per metode, modal part, laba kotor,
  lima jasa dan lima part terlaris, dan jumlah SPK selesai per mekanik. SPK batal tidak dihitung.
- **Laba kotor** = subtotal jasa + subtotal part − modal part (jasa bermodal 0). Part yang harga
  belinya 0 diberi catatan "Harga beli belum lengkap" seperti kafe-resto.

## Data

| Tabel | Isi |
|---|---|
| `staff` | pemilik, kasir, mekanik: nama, email, hash sandi (bcrypt), peran, aktif |
| `staff_sessions` | token sesi web (hanya hash SHA-256) |
| `outlet` | satu baris: nama, tagline, alamat, nomor WA, jam buka, tautan peta, kaki nota |
| `customers` | nama, nomor HP (unik), alamat, catatan |
| `vehicles` | pelanggan, jenis (`MOTOR`/`CAR`), plat tampilan, kunci plat (unik), merek, tipe, tahun, warna |
| `services` | jasa: nama (unik), deskripsi, harga, durasi (menit), tampil di website, aktif, urutan |
| `parts` | sparepart: SKU (unik), nama, satuan, harga jual, harga beli (hanya pemilik), stok, stok minimum, aktif |
| `stock_movements` | kartu stok: part, jenis, jumlah bertanda, stok sesudah, catatan, SPK, staf |
| `counters` | penghitung nomor SPK dan booking |
| `bookings` | nomor, data pemesan dan kendaraan (salinan), jasa (salinan nama), tanggal datang, keluhan, status, alasan tolak, hash token booking, SPK hasil konversi |
| `work_orders` | SPK: nomor, pelanggan, kendaraan, booking, mekanik, status, keluhan, diagnosis, odometer, estimasi selesai, subtotal jasa dan part, total, terbayar, alasan batal, hash token lacak, pembuat |
| `work_order_items` | salinan jasa atau part: jenis, nama, harga jual, harga beli, jumlah, subtotal |
| `work_order_status_logs` | linimasa status |
| `payments` | jumlah, metode, pencatat, waktu |
| `wa_messages` | pesan WhatsApp keluar: jenis, tujuan, isi, status kirim |

ID `CHAR(36)` UUID dari aplikasi, waktu `DATETIME(3)` UTC, tanggal booking `DATE` WIB,
migration SQL bersama di `db/migrations` (golang-migrate), tanpa ORM, sama seperti produk lain.
Aturan penting dijaga juga oleh `CHECK` di database.

## API (ringkas)

Awalan `/api`. Rinciannya nanti di `spec/openapi.yaml` sebagai satu-satunya sumber kebenaran.

- **Umum:** `GET /api/health`, `GET /api/outlet` (publik).
- **Setup dan staf:** `GET/POST /api/setup`, `POST /api/staff/login`, `POST /api/staff/logout`,
  `GET /api/staff/me`, `GET/POST /api/staff`, `PATCH /api/staff/{staffId}` (pemilik).
- **Publik:** `GET /api/public/services`, `POST /api/public/bookings`,
  `GET /api/public/bookings/{bookingToken}`, `POST /api/public/bookings/{bookingToken}/cancel`,
  `GET /api/public/work-orders/{trackingToken}`.
- **Pelanggan dan kendaraan (pemilik, kasir):** `GET/POST /api/customers`,
  `GET/PATCH /api/customers/{customerId}`, `POST /api/customers/{customerId}/vehicles`,
  `GET /api/vehicles?plate=`, `PATCH /api/vehicles/{vehicleId}`,
  `GET /api/vehicles/{vehicleId}/work-orders` (riwayat servis).
- **Jasa:** `GET /api/services` (semua staf), `POST /api/services`,
  `PATCH /api/services/{serviceId}` (pemilik).
- **Sparepart dan stok:** `GET /api/parts` (semua staf; `costPrice` hanya untuk pemilik),
  `POST /api/parts`, `PATCH /api/parts/{partId}`, `GET …/movements`, `POST …/stock-in`,
  `…/stock-out`, `…/stock-count` (pemilik).
- **Booking (pemilik, kasir):** `GET /api/bookings`, `GET /api/bookings/{bookingId}`,
  `POST …/confirm`, `…/reject`, `…/convert`.
- **SPK:** `GET /api/work-orders` (semua staf; mekanik hanya miliknya; filter status, mekanik,
  tanggal, cari nomor/plat/nama/HP), `GET /api/work-orders/{number}`, `POST /api/work-orders`
  (kasir), `PATCH /api/work-orders/{number}` (kasir: mekanik, keluhan, odometer, estimasi;
  mekanik: diagnosis), `POST …/status` (semua staf), `…/cancel`, `…/items`,
  `DELETE …/items/{itemId}`, `…/payments`, `…/wa`, `…/tracking-link` (buat ulang tautan lacak)
  (kasir).
- **Pemilik:** `PUT /api/outlet`, `GET /api/reports/daily?date=YYYY-MM-DD`.

"Kasir" di daftar ini berarti pemilik dan kasir.

## Teknologi dan susunan repo

```
bengkel/
  spec/                 kontrak API (OpenAPI 3.1) dan templat WhatsApp            (Bagian 0a)
  db/                   migration dan pembuat database                             (Bagian 0a)
  docker-compose.yml    MySQL 8.4 + runner migration                               (Bagian 0a)
  tests/kontrak/        tes kontrak lintas backend (Vitest)                        (Bagian 0b)
  tests/wa-palsu/       WhatsApp palsu: menerima pesan dan menampilkannya          (Bagian 0b)
  backend-laravel/      Laravel 13, Query Builder, app/Modules/Servis dll.         (Bagian 1)
  web/                  Next.js 15: website publik + panel staf                    (Bagian 2)
  tests/e2e/            Playwright, satu perintah per backend                      (Bagian 3)
  alat/                 pengemas paket jualan dan pembuat panduan Word             (Bagian 3, 4)
  backend-go/           net/http, database/sql, internal/servis dll.               (menyusul)
  backend-nestjs/       NestJS 11, Knex, src/modules/servis dll.                   (menyusul)
  mobile/               Flutter: aplikasi staf                                     (menyusul)
  docs/                 rancangan, panduan menjalankan, dan panduan Word (docs/panduan)
```

Nama folder dan modul memakai bahasa Indonesia seperti produk lain
(`app/Modules/Servis/ServisService.php`, nanti `backend-go/internal/servis/usecase.go` dan
`src/modules/servis/servis.service.ts`).

Web memanggil backend dari server Next.js (BFF) dengan token di cookie `httpOnly`; halaman
publik memanggil rute `/api/public/*` dan `GET /api/outlet` lewat BFF yang sama tanpa cookie.
Landing page dirender di server supaya terbaca mesin pencari.

**Port lokal** tidak bentrok dengan KodeCoding maupun produk lain (laundry 3310/84xx, toko online
3320/85xx, kafe 3330/86xx, SIAKAD 3340/87xx):

| Layanan | Dev | Uji (tes kontrak) | E2E (Go / Laravel / NestJS) |
|---|---|---|---|
| MySQL (proyek compose `bengkel`) | 3350 | 3350 | 3350 |
| Backend Go / Laravel / NestJS | 8801 / 8802 / 8803 | 8881 / 8882 / 8883 | 8811 / 8812 / 8813 |
| Web Next.js | 3800 | 3880 | 3811 / 3812 / 3813 |
| WhatsApp palsu | 8890 | 8891 / 8892 / 8893 | 8814 / 8815 / 8816 |

Database: `bengkel` (dev), `bengkel_uji`, `bengkel_uji_laravel`, `bengkel_uji_nestjs`,
E2E `bengkel_e2e_go`, `bengkel_e2e_laravel`, `bengkel_e2e_nestjs`. Review independen di port
8861-8870, database `bengkel_review_*`.

**Identitas netral:** nama bengkel dari profil `outlet` (bawaan "Nama Bengkel"), logo bawaan
polos. Setiap berkas kode diawali header hak cipta ariefmanggalaputra, `LICENSE` sama dengan
produk lain. Sapaan UI "kamu".

### Halaman web (rencana Bagian 2)

Tampilan semua halaman mengikuti sistem desain `kafe-resto/web` (lihat "Keputusan pengguna").

Publik, tanpa masuk: `/` (halaman depan: nama dan tagline outlet, tombol booking dan WhatsApp,
jasa dan harga dari API, langkah booking, alamat, jam buka, tautan peta, FAQ), `/booking` (form),
`/booking/[bookingToken]` (status booking, batalkan selagi menunggu),
`/servis/[trackingToken]` (status, linimasa, rincian item, total, terbayar, sisa).

Panel staf, di bawah `/admin`: `/admin/setup`, `/admin/masuk`, **Papan servis** (SPK per
status; untuk mekanik hanya miliknya), **SPK baru** (cari plat/HP atau tambah pelanggan dan
kendaraan), **Rincian SPK** (status, mekanik, diagnosis, item jasa dan part, bayar dengan
kembalian, batalkan, kirim WhatsApp, cetak nota 58 mm), **Booking** (masuk, konfirmasi, tolak,
jadikan SPK), **Pelanggan** (+ kendaraan dan riwayat servis), dan untuk pemilik: **Jasa**,
**Sparepart** (+ kartu stok, stok masuk/keluar/hitung ulang, daftar stok menipis), **Staf**,
**Outlet**, **Rekap**.

## Bagian eksekusi

| Bagian | Isi | Selesai bila |
|---|---|---|
| 0a. Fondasi | rancangan, spec, migration, docker-compose, panduan menjalankan | migration maju-mundur-maju bersih, spec lolos lint |
| 0b. Alat uji | tes kontrak, WhatsApp palsu, `docs/eksekusi/` per bagian | harness hijau, tes kontrak lengkap (merah), WA palsu hijau |
| 1. Backend Laravel | semua rute | tes kontrak hijau (urut dan diacak); PHPUnit dan Pint bersih |
| 2. Web | website publik dan panel staf | alur booking → SPK → item → selesai → bayar → diambil berjalan melawan Laravel; typecheck, lint, tes hijau |
| 3. E2E dan paket | Playwright, ZIP `bengkel-laravel-web-<versi>.zip` | E2E hijau melawan Laravel; ZIP lolos pemeriksa |
| 4. Panduan Word | empat panduan di `docs/panduan/`, dibuat `alat/panduan-word` | keempatnya terbuka di Word tanpa dialog perbaikan |
| Menyusul | backend Go, backend NestJS, aplikasi staf Flutter | tes kontrak hijau; paket varian lain |

Estimasi ukuran, dari kafe-resto yang strukturnya mirip: backend 8–10 ribu baris, web ±12 ribu
(ada website publik), tes kontrak ±5 ribu.

## Risiko dan hal yang belum pasti

- **Laravel menjadi backend pertama.** Di produk lain spec dibuktikan lebih dulu oleh Go, yang
  menjalankan tes serentak dengan benar. Server bawaan PHP melayani satu permintaan sekaligus,
  jadi tes serentak (nomor SPK, stok terakhir) harus dijalankan di Nginx + PHP-FPM seperti
  catatan kafe-resto.
- **Booking membuka pintu publik.** Pengamannya: penerimaan staf, batas 3 menunggu per nomor,
  tanpa WhatsApp otomatis dari form publik, dan rate limit proxy (wajib, belum bisa diuji dari
  dalam aplikasi).
- **WhatsApp belum diuji dengan akun Fonnte sungguhan**, hanya dengan WhatsApp palsu.
- **Booking tidak membatasi kapasitas per hari**; staf mengatur sendiri lewat konfirmasi.
- **Kardinalitas kecil diasumsikan**: daftar jasa publik satu respons tanpa paginasi.
- Harga jual paket di KodeCoding belum ditentukan.

## Di luar MVP

Banyak cabang, diskon dan voucher, void atau refund pembayaran, pembayaran online, penjualan
sparepart langsung tanpa SPK, pembelian ke pemasok dan utang dagang, kapasitas atau slot booking
per jam, pengingat servis berkala otomatis, member dan poin, foto kendaraan dan sparepart, komisi
mekanik, garansi per SPK, laporan bulanan, ekspor Excel, tampilan real-time (WebSocket/SSE),
printer thermal lewat USB atau jaringan, dan aplikasi mobile (aplikasi staf menyusul).
