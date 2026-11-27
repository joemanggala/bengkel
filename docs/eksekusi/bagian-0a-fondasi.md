# Bagian 0a: Fondasi Aplikasi Bengkel

Baca `docs/rancangan.md` dan `docs/eksekusi/aturan-bersama.md` lebih dulu: peran, alur, status
SPK dan booking, aturan bisnis, data, dan daftar API ada di sana. Bagian ini membuat kontrak dan
infrastruktur yang dibutuhkan backend sebelum backend pertama ditulis: spec, migration,
docker-compose, dan panduan menjalankan. **Tidak ada kode backend, web, atau tes kontrak di
bagian ini** (tes kontrak dan WhatsApp palsu milik Bagian 0b).

## Acuan (hanya dibaca)

`D:\KODE_PRODUK\kafe-resto` sudah melewati pola yang sama dan teruji di tiga backend. Tiru
susunan, gaya, dan konvensinya; jangan menyalin isi bisnisnya.

- `spec/` (openapi dipecah ke `paths/` dan `components/`, `redocly.yaml`), `spec/whatsapp.md`.
  **Semua konvensi umum di sana berlaku di sini**: bentuk galat
  `{"error": {"code", "message", "fields"?}}`, paginasi, ID UUID `CHAR(36)`, waktu
  `DATETIME(3)` UTC, rupiah `BIGINT`, setup pemilik pertama dengan `SETUP_TOKEN`, sesi staf
  opaque (hash SHA-256, 30 hari bergeser), bcrypt cost 12, 403 `forbidden` untuk peran yang
  salah.
- `db/init/`, `db/migrations/` (golang-migrate, dengan `CHECK` untuk aturan penting),
  `docker-compose.yml` (image MySQL dan migrate dipatok digest), `docs/menjalankan.md`.
- Modul stok kafe-resto (migration `000004_stok_bahan`, path dan skema bahan, kartu stok) untuk
  kartu stok sparepart; rute `/api/public/*` kafe-resto untuk `bookingToken` dan
  `trackingToken`.

Pakai versi dependensi yang sama dengan kafe-resto (redocly, image MySQL dan migrate) supaya
cache yang ada terpakai.

## Hasil yang diminta

| Berkas | Isi |
|---|---|
| `README.md`, `.gitignore`, `VERSION` (`0.1.0`) | ringkas; README merujuk ke `docs/` |
| `docker-compose.yml` | proyek compose `bengkel`, MySQL 8.4 di port **3350**, `migrate-dev`, `migrate-uji` (Go), `migrate-uji-laravel`, `migrate-uji-nestjs` |
| `db/init/01-buat-database.sql` | `bengkel`, `bengkel_uji`, `bengkel_uji_laravel`, `bengkel_uji_nestjs` |
| `db/tanpa-docker.sql` | pembuat database untuk MySQL tanpa Docker (seperti laundry) |
| `db/migrations/000001_awal.{up,down}.sql` | semua tabel di rancangan, dengan indeks, batasan unik, dan `CHECK` yang dibutuhkan aturan bisnis; baris awal `outlet` bernama "Nama Bengkel" dan baris `counters` |
| `spec/openapi.yaml` + `spec/paths/*` + `spec/components/*` + `spec/redocly.yaml` | seluruh API di rancangan |
| `spec/whatsapp.md` | penyedia WhatsApp dan templat pesan, byte demi byte |
| `docs/menjalankan.md` | cara menyalakan MySQL, migration, dan lint spec (bagian WA palsu dan tes kontrak ditambahkan Bagian 0b) |

## Keputusan yang sudah diambil

**Peran dan sesi**
- Staf berperan `owner`, `cashier`, atau `mechanic`. Masuk dengan email + sandi, tanpa OTP.
- Rute khusus pemilik yang dipanggil kasir atau mekanik → 403 `forbidden`. Rute kasir yang
  dipanggil mekanik → 403 `forbidden`.
- Setup pemilik pertama persis kafe-resto (`GET/POST /api/setup`, `setup_disabled`,
  `setup_token_invalid`, `already_set_up`, dua permintaan bersamaan hanya menghasilkan satu
  pemilik).
- Mekanik yang dinonaktifkan tidak bisa ditugaskan ke SPK baru (422), tetapi SPK lamanya tetap
  menampilkan namanya.

**Nomor HP dan plat**
- HP: terima `08…`, `+628…`, `628…` (boleh spasi dan tanda hubung), simpan `628…`, 10–15 digit.
  Selain itu 422 dengan kode `fields` yang jelas. Nomor pelanggan unik (409 `phone_taken`).
- Plat: kunci = huruf besar tanpa spasi dan tanda baca, 2–12 karakter alfanumerik, harus
  diawali huruf. Tampilan = huruf depan, angka, huruf belakang dipisah satu spasi
  (`b1234xyz` → `B 1234 XYZ`). Unik berdasarkan kunci (409 `plate_taken`). Tulis aturan
  pemisahannya di spec dengan contoh, termasuk plat yang tidak mengikuti pola huruf-angka-huruf
  (disimpan apa adanya dalam huruf besar).

**Jasa, sparepart, dan stok**
- Jasa: `price` ≥ 0, `durationMinutes` opsional, `isPublic`, `isActive`, `sortOrder`.
- Part: `sku` unik, `unit` teks bebas pendek (mis. `pcs`, `liter`, `set`), `price` ≥ 0,
  `costPrice` ≥ 0 (hanya pemilik: kuncinya **tidak ada** di respons untuk kasir dan mekanik),
  `stock` ≥ 0, `minStock` ≥ 0. Stok hanya berubah lewat endpoint stok dan item SPK, bukan lewat
  `PATCH` part. Daftar part bisa difilter `lowStock=true` (`stock <= minStock`).
- Kartu stok: `IN`, `OUT` (wajib catatan), `COUNT` (stok baru, wajib catatan), `USED`,
  `RETURNED`; `quantity` bertanda dan `stockAfter`.

**Booking**
- `POST /api/public/bookings` → 201 `{data: {booking, bookingToken}}`. Token acak 32 byte, hanya
  dikirim sekali, hanya hash yang disimpan.
- Tanggal datang hari ini sampai 30 hari ke depan menurut WIB (422). Jasa opsional, harus aktif
  dan `isPublic` (422). Paling banyak 3 booking `PENDING` per nomor HP (409
  `too_many_pending_bookings`).
- Respons publik booking tidak memuat data staf maupun alasan internal selain alasan tolak.
- Konversi: pelanggan dicari dari HP dan dibuat bila belum ada; kendaraan dicari dari kunci plat
  dan dibuat bila belum ada; plat milik pelanggan lain → 409 `plate_owned_by_other_customer`;
  jasa booking (bila masih aktif) menjadi item pertama dengan harga katalog saat konversi.

**SPK**
- Nomor `S-` + angka berurutan minimal 4 digit, booking `B-` dengan aturan sama, dibuat di
  transaksi dengan penguncian baris tabel penghitung. Tes wajib (di Bagian 0b) membuat banyak
  SPK bersamaan dan memastikan nomornya unik dan berurutan tanpa celah.
- Status dan transisi persis rancangan, dengan kode galat `status_transition_invalid`,
  `not_paid_off`, `has_payments`, `work_order_locked`.
- ~~`trackingToken` dikembalikan sekali, hanya hash disimpan~~ **Diganti keputusan 0a-1
  (diterima koordinator):** token lacak acak 32 byte disimpan apa adanya dan ada di setiap
  rincian SPK staf; `POST …/tracking-link` membuat token baru dan mematikan tautan lama (404).
  Ikuti `spec/`.
- Item: `type` `SERVICE` | `PART`, jumlah 1–99, paling banyak 50 item per SPK (422), harga jasa
  boleh diisi (≥ 0), harga part selalu dari katalog. `costPrice` item tidak pernah ada di
  respons SPK untuk siapa pun (hanya dipakai rekap).
- Pembayaran `cash` | `transfer` | `qris`, jumlah 1 sampai sisa tagihan (melebihi → 422), tidak
  bisa untuk SPK batal atau sudah diambil (409). Status bayar turunan `unpaid` | `partial` |
  `paid`.
- Respons publik SPK (`GET /api/public/work-orders/{trackingToken}`): profil outlet, nomor,
  status, linimasa (tanpa catatan dan nama staf), kendaraan, nama mekanik tidak ditampilkan,
  item (tanpa harga beli), total, terbayar, sisa, nama pelanggan, dan HP disamarkan
  (`6281****7890`).

**WhatsApp**
- Kirim lewat API HTTP berbentuk **Fonnte**, seperti produk lain. Cek ulang bentuknya ke
  dokumentasi resmi Fonnte (mis. lewat WebFetch), lalu tulis di `spec/whatsapp.md` apa yang
  dipakai dan tanggal pengecekannya. Bila dokumentasi tidak bisa dibuka, salin bentuk dari
  `kafe-resto/spec/whatsapp.md` dan sebutkan di laporan.
- Env: `WA_API_URL`, `WA_TOKEN`, dan `PUBLIC_WEB_URL` (untuk merangkai tautan
  `/booking/{token}` dan `/servis/{token}` di pesan).
- Jenis pesan: `booking_confirmed` (otomatis saat dikonfirmasi), `booking_rejected` (otomatis
  saat ditolak, memuat alasan), `work_order_created` (otomatis saat SPK dibuat, memuat tautan
  lacak), `work_order_done` (otomatis saat `DONE`, memuat total dan tautan), `receipt` (nota,
  atas permintaan kasir). Templat ditulis byte demi byte, termasuk format rupiah (`Rp150.000`),
  tanggal (`27-11-2026`), waktu (`27-11-2026 14:05 WIB`), dan plat tampilan.
- Setiap pesan dicatat di `wa_messages`; gagal kirim tidak menggagalkan transaksi.
  `POST /api/work-orders/{number}/wa {type}` mengirim ulang `work_order_created`,
  `work_order_done`, atau `receipt`. Respons SPK memuat status pesan terakhir per jenis.

**Rekap harian** `GET /api/reports/daily?date=YYYY-MM-DD` (pemilik): isi persis rancangan.

**Lain-lain**: `GET /api/health` seperti produk lain. `GET /api/outlet` publik.
`GET /api/public/services` satu respons tanpa paginasi, hanya jasa aktif dan publik, urut
`sortOrder` lalu nama.

## Tanda selesai

- [ ] `docker compose up -d mysql` lalu migration naik, turun, dan naik lagi dengan bersih di
      `bengkel_uji`.
- [ ] Setiap pelanggaran aturan bisnis yang dijaga `CHECK` atau batasan unik dibuktikan ditolak
      database dengan skrip (catat jumlahnya di laporan, seperti kafe-resto).
- [ ] Spec lolos `redocly lint` tanpa galat dan peringatan; `operationId` unik.
- [ ] Contoh respons sah lolos skema dan contoh salah ditolak, terutama kebocoran `costPrice`
      untuk kasir, HP tidak tersamar di respons publik, dan token pendek.
- [ ] Setiap berkas kode diawali dua baris header hak cipta.
- [ ] Bagian "Yang sudah terverifikasi di Bagian 0a" ditambahkan ke `docs/rancangan.md`.

## Batasan

- Patuhi `docs/eksekusi/aturan-bersama.md`. Produk lain dan `D:\KODE_BELAJAR` hanya dibaca.
- Kontainer MySQL baru proyek `bengkel` di port 3350 boleh dinyalakan.
- Jangan commit. Jangan menulis kredensial sungguhan; `.env.example` berisi nilai contoh.

## Laporan akhir

Ringkas: apa yang dibuat, jumlah operasi di spec, jumlah pelanggaran yang ditolak database,
keputusan yang kamu ambil sendiri (beserta alasannya), hasil pengecekan API Fonnte, dan
pertanyaan terbuka.
