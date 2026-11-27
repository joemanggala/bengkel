# Aplikasi Bengkel: backend Laravel

Backend REST API aplikasi bengkel motor dan mobil untuk satu outlet: website
publik dengan booking online, SPK servis dengan status dan mekanik, kasir,
stok sparepart, pelanggan dan kendaraan beserta riwayat servisnya, dan rekap
harian. Ditulis dengan Laravel 13 di PHP 8.4, memakai Query Builder
`DB::table()` + MySQL tanpa Eloquent, sesi Bearer di database, dan pesan
WhatsApp lewat API kirim berbentuk Fonnte.

Perilakunya ditetapkan oleh kontrak OpenAPI di `../spec`, bukan oleh kode
ini. Web Next.js hanya berbicara lewat kontrak itu, jadi backend lain yang
mengikuti kontrak yang sama bisa menggantikan backend ini cukup dengan
mengganti alamat API, dan database yang sama tetap terbaca (hash sandi, token
sesi, nomor SPK, dan semua aturannya ditetapkan di kontrak).

<!-- kemas:abaikan-mulai -->
Di repo ini kontrak yang sama dipakai semua varian backend (Laravel lebih
dulu, Go dan NestJS menyusul).

<!-- kemas:abaikan-selesai -->

Semua 52 operasi di kontrak sudah diimplementasikan: setup dan staf (tiga
peran: pemilik, kasir, mekanik), profil outlet, pelanggan dan kendaraan beserta
riwayat servisnya, katalog jasa, sparepart dan kartu stok (harga beli khusus
pemilik), booking dari website (publik tanpa akun) beserta konfirmasi,
penolakan, dan konversinya menjadi SPK, SPK lengkap (status, mekanik, item
jasa dan part dengan stok yang berkurang dan kembali otomatis, pembayaran
bertahap, pembatalan, WhatsApp, tautan lacak), halaman lacak servis publik,
dan rekap harian beserta laba kotor.

Dependensi langsung, versinya dipatok persis di `composer.json` supaya
`composer install` di mesin mana pun memasang versi yang sama dengan yang
sudah diuji:

| Paket | Untuk |
|---|---|
| `laravel/framework` 13.36.0 | kontainer, routing, middleware, Query Builder, konsol |
| `guzzlehttp/guzzle` 8.2.0 | HTTP ke penyedia WhatsApp |
| `phpunit/phpunit` 13.3.6 (dev) | unit test dan tes pipa HTTP |
| `laravel/pint` 1.32.1 (dev) | format kode |

Sisanya (validasi JSON ketat, normalisasi nomor HP dan plat, format rupiah
dan waktu WIB, aturan status SPK dan booking) ditulis sendiri, supaya setiap
aturan kontrak bisa dibaca dan dipelajari langsung dari kodenya.

## Arsitektur

```
backend-laravel/
  artisan                     perintah konsol, termasuk bengkel:serve, bengkel:periksa, bengkel:migrate
  server.php                  router php -S: semua permintaan ke Laravel
  public/index.php            pintu masuk HTTP
  bootstrap/app.php           middleware global, alias middleware, penangan galat
  config/                     pengaturan Laravel (database, log, cache, sesi, disk)
  app/
    Providers/                AppServiceProvider (utilitas bersama),
                              ModuleServiceProvider (mendaftarkan semua modul)
    Http/Middleware/          EnforceRouteShape, ReadJsonBody, AuthenticateStaff, RequireRole
    Console/Commands/         ServeCommand (bengkel:serve), PeriksaCommand (bengkel:periksa),
                              MigrateCommand (bengkel:migrate: migration tanpa Docker)
    Modules/                  satu folder per domain bisnis
      Kesehatan/              GET /api/health
      Sesi/                   token Bearer staf (tabel staff_sessions), peran owner/cashier/mechanic
      Staf/                   pemilik pertama (setup), masuk/keluar, kelola akun staf, daftar mekanik
      Outlet/                 profil bengkel: nama, tagline, alamat, nomor WA, jam buka, peta, kaki nota
      Pelanggan/              pelanggan dan kendaraannya (nomor HP dan plat seragam, pencarian)
      Jasa/                   katalog jasa staf dan daftar jasa publik website
      Sparepart/              sparepart, harga beli khusus pemilik, LevelStok (ok/low/out)
      Stok/                   kartu stok: masuk, keluar, hitung ulang; JenisPergerakan, PesanStokKurang
      Booking/                booking publik (token sekali, batas 3 menunggu per HP), konfirmasi dan
                              tolak oleh staf; StatusBooking, NomorBooking, TanggalDatang
      Servis/                 SPK: daftar, rincian, buat, ubah, status, batal, item, pembayaran,
                              kirim ulang WA, tautan lacak, riwayat kendaraan, konversi booking,
                              halaman lacak publik; aturan murni StatusSpk, AturanSpk (403/409 beserta
                              urutannya), BatasMekanik (hanya SPK miliknya), StatusBayar, NomorSpk
      WhatsApp/               templat lima pesan (byte demi byte) dan pencatatan wa_messages
      Rekap/                  rekap harian (tanggal WIB) dan laba kotor
    Support/                  alat generik yang tidak tahu apa-apa soal bengkel
      Config/                 membaca dan memeriksa env bersama (Settings, PemeriksaanPasang)
      Migrasi/                menjalankan ../db/migrations dan mencatat versinya seperti
                              golang-migrate, dipakai bengkel:migrate
      Http/                   ApiError (galat kontrak), ApiResponse, Page, QueryParams,
                              RawBody, LogGalat, LogAkses
      Validation/             JsonObject (validasi JSON ketat per field), PhoneNumber (bentuk
                              seragam dan samaran), Plate (kunci dan tampilan plat),
                              ControlChars (karakter kontrol di teks form publik)
      Format/                 rupiah dan bilangan untuk teks pesan
      Database/               Transaksi (ulang saat deadlock), escape LIKE, aturan cocok
                              pencarian (nama, nomor, HP, plat), galat MySQL
      Security/               token acak, UUID, bcrypt, batas percobaan masuk
      Text/ Time/             pemangkasan kontrak, jam aplikasi, waktu WIB, WaktuMasukan
  tests/
    Unit/                     kelas murni, tanpa Laravel dan database
    Feature/                  pipa HTTP Laravel lengkap, pengulangan transaksi, dan
                              bengkel:migrate, tanpa database (kecuali tes migration bila
                              TEST_DATABASE_URL diisi)
    Fakes/                    jam, repository sesi, dan batas masuk tiruan
```

Setiap modul yang punya rute memakai pola yang sama:

| Berkas | Tugas |
|---|---|
| `XxxServiceProvider.php` | mengikat repository ke kontraknya dan mendaftarkan rute beserta middleware-nya |
| `XxxController.php` | membaca path/query/badan, memanggil service, menulis balasan |
| `Requests/` | aturan validasi badan yang cukup besar |
| `XxxService.php` | aturan bisnis; tidak tahu soal HTTP, mengembalikan data atau melempar `ApiError` |
| `Contracts/XxxRepositoryInterface.php` | kontrak akses data yang dipakai service |
| `XxxRepository.php` | query `DB::table(...)`; tidak tahu soal aturan bisnis |

Modul SPK berada di `app/Modules/Servis` dengan `ServisService.php`. Nama
modul, kelas domain, dan metodenya berbahasa Indonesia mengikuti istilah
bengkel (`StatusSpk::bolehKe`, `BatasMekanik::bolehBuka`), sedangkan
`app/Support` berisi alat generik. Kode status, kode galat, dan nama field
JSON tetap bahasa Inggris sesuai kontrak.

Tidak ada model Eloquent, migration Laravel, sesi Laravel, cache database,
atau antrean. Skema hanya berasal dari `../db/migrations`, dijalankan lewat
Docker atau `php artisan bengkel:migrate`.

## Alur satu permintaan

```
EnforceRouteShape   HEAD, OPTIONS, path tak rapi (//, akhiran /) → 404 JSON
└─ router Laravel   rute tak dikenal atau metode salah → 404 JSON (ErrorRenderer)
   └─ json          ReadJsonBody: > 1 MiB → 413, bukan objek JSON / byte UTF-8 rusak → 400
      └─ staff      AuthenticateStaff: token Bearer bukan sesi staf aktif → 401
         └─ peran   RequireRole (mis. peran:owner,cashier): peran lain → 403
            └─ controller → service: 404 → 403 kepemilikan SPK (mekanik) → 422 → 409
```

Urutan middleware di rute sengaja sama dengan urutan pemeriksaan di kontrak.
Jadi JSON rusak tanpa token dibalas 400, dan kasir yang mengirim JSON sah ke
rute pemilik dibalas 403. Rute staf tanpa badan tidak memakai `json`, sehingga
badannya diabaikan sepenuhnya (JSON rusak pun tetap 2xx). Rute publik tidak
memakai `staff`, sehingga header `Authorization` diabaikan sepenuhnya.

## Keputusan teknis

- **Laravel 13.36.0**, sama persis dengan backend Laravel produk lain;
  `composer.lock` disalin supaya cache Composer terpakai dan semua
  dependensi tidak langsung juga sama.
- **Tanpa Eloquent.** Semua query lewat Query Builder, dengan
  `lockForUpdate()` untuk bagian yang wajib berurutan dan indeks unik
  database untuk aturan "tidak boleh ganda".
- **Validasi JSON sendiri** (`Support/Validation/JsonObject`). Validator
  bawaan Laravel menerima `"15000"` sebagai integer dan `1` sebagai boolean,
  dan tidak membedakan `null` dari field yang tidak dikirim. Semua regex
  memakai pengubah `D` (tanpa itu `$` PHP juga cocok sebelum baris baru di
  akhir teks). Badan yang bersarang lebih dari 64 tingkat dan surrogat
  tunggal dalam escape ditolak 400.
- **Query string dibaca sendiri** (`Support/Http/QueryParams`): pemisah
  pasangan hanya `&`, jadi `;` adalah data biasa, dan kemunculan pertama
  yang dipakai.
- **Middleware global bawaan Laravel diganti.** `TrimStrings` dan
  `ConvertEmptyStringsToNull` mengubah input (sandi dan token tidak boleh
  dipangkas), `ValidatePostSize` membalas 413 versi Laravel, `HandleCors`
  menambah header CORS (kontrak tanpa CORS), dan router Laravel otomatis
  menjawab HEAD dan OPTIONS (kontrak: 404).
- **Guard sesi sendiri** (`Modules/Sesi`), bukan guard auth Laravel: token
  opaque 43 karakter (32 byte acak, base64url tanpa padding), database hanya
  menyimpan hex SHA-256-nya. Sesi 30 hari, bergeser; perpanjangan ditulis
  paling sering sekali per 5 menit. Peran dibaca dari database setiap
  permintaan; staf nonaktif langsung kehilangan aksesnya.
- **Sandi bcrypt cost 12.** PHP menulis awalan `$2y$`; awalan `$2a$` dan
  `$2b$` (ditulis pustaka bcrypt bahasa lain) juga diterima karena
  algoritmanya sama, jadi hash yang dibuat aplikasi lain di database yang sama
  tetap bisa dipakai masuk. Diuji dengan hash fixtur untuk ketiga awalan.
- **Jam aplikasi** (`Support/Time/Clock`): UTC, dipotong ke milidetik,
  ditulis ke `DATETIME(3)` dengan format `Y-m-d H:i:s.v`; koneksi MySQL
  memasang `timezone` `+00:00`. `NOW()` MySQL tidak dipakai. WIB (UTC+7
  tetap, `Support/Time/Wib`) hanya untuk teks pesan, filter tanggal, batas
  tanggal datang booking, dan rekap.
- **Server HTTP dev: `php -S` lewat `php artisan bengkel:serve`.**
  `php artisan serve` bawaan tidak dipakai karena membaca port dari `--port`,
  bukan env `PORT` bersama; membuang env dari shell selama ada berkas `.env`
  (padahal env dari shell seharusnya menang, lihat Konfigurasi); tidak memeriksa env
  dan database sebelum menyala; dan router-nya melayani berkas statis.
  `bengkel:serve` menjalankan pemeriksaan `bengkel:periksa` lebih dulu, lalu
  server bawaan PHP dengan `enable_post_data_reading=0`, `display_errors=0`
  dengan `log_errors=1` ke stderr (peringatan PHP tidak boleh tercampur ke
  badan JSON), dan OPcache. Baris log aksesnya dibersihkan dari query string
  dan token publik di path.

## Konfigurasi

Nama env sama di semua varian backend; contohnya ada di `.env.example`. Env
bisa ditulis di `.env` (tidak dilacak git) atau langsung di shell; env dari
shell selalu menang. Env khas Laravel (`APP_KEY`, `APP_ENV`, `DB_*`,
`LOG_CHANNEL`) tidak dipakai. Semua nilai dipangkas; kosong sesudah dipangkas
= tidak diisi.

| Env | Wajib | Isi |
|---|---|---|
| `PORT` | ya | port HTTP, mis. 8802 |
| `DATABASE_URL` | ya | `mysql://user:sandi@host:port/database` |
| `WA_API_URL` | ya | alamat kirim **lengkap dengan path**, mis. `https://api.fonnte.com/send` |
| `WA_TOKEN` | ya | token penyedia WhatsApp, hanya karakter ASCII terlihat (0x21–0x7E), dikirim apa adanya tanpa `Bearer` |
| `PUBLIC_WEB_URL` | ya | alamat website publik untuk tautan di pesan WhatsApp, diawali `http://` atau `https://`; garis miring di akhir dibuang |
| `SETUP_TOKEN` | tidak | token pembuatan pemilik pertama, minimal 16 byte; kosong = `POST /api/setup` mati (403) |

Env kosong atau tidak sah membuat `php artisan bengkel:serve` menolak menyala
dengan pesan yang menyebut nama env-nya, tanpa mencetak isinya. Di balik
PHP-FPM, jalankan `php artisan bengkel:periksa` (dengan env yang sama dengan
pool FPM) setiap kali memasang atau mengubah env.

**Jangan menjalankan `php artisan config:cache` atau `php artisan optimize`**
bila env ditulis di `.env`: sesudah config di-cache Laravel berhenti memuat
`.env`, sehingga `DATABASE_URL` dan env lain mendadak kosong (500). Bila
pernah terlanjur, hapus dengan `php artisan config:clear`.

## Menjalankan

Prasyarat: PHP 8.4 (ekstensi `pdo_mysql`, `mbstring`, `openssl`, `curl`;
OPcache dianjurkan), Composer 2, dan Docker Desktop untuk MySQL (atau MySQL 8
yang dipasang sendiri).

```sh
# Dari folder project (satu tingkat di atas backend-laravel):
docker compose up -d mysql
docker compose run --rm migrate-dev up

# Backend Laravel di http://localhost:8802
cd backend-laravel
composer install
cp .env.example .env               # lalu isi SETUP_TOKEN bila perlu (minimal 16 byte)
php artisan bengkel:serve          # atau: composer serve
```

Server mendengarkan `127.0.0.1`; pakai `php artisan bengkel:serve --host=0.0.0.0`
bila backend perlu dijangkau dari perangkat lain di jaringan yang sama.

### Tanpa Docker

Dengan MySQL 8 yang dipasang sendiri (bukan MariaDB, jadi bukan XAMPP),
jalankan `db/tanpa-docker.sql` di folder project sekali sebagai root, ganti
port di `DATABASE_URL` ke port MySQL-mu (umumnya 3306), lalu dari folder
backend-laravel:

```sh
php artisan bengkel:migrate            # sama dengan "up": jalankan yang belum
php artisan bengkel:migrate versi      # versi database saat ini
php artisan bengkel:migrate paksa 1    # tetapkan versi setelah memperbaiki migration yang gagal
```

Hanya `DATABASE_URL` yang dibaca, jadi tabel bisa dibuat sebelum env lain
diisi. `bengkel:migrate` meniru golang-migrate (tabel `schema_migrations`,
tanda kotor, kunci `GET_LOCK`), jadi satu database boleh dimigrasi
bergantian lewat Docker atau lewat perintah ini. Hanya arah naik yang
disediakan.

## Menguji

<!-- kemas:abaikan-mulai -->
Ada dua lapis tes.
<!-- kemas:abaikan-selesai -->

**PHPUnit** (`composer test`) tidak butuh database dan berjalan beberapa detik:
`tests/Unit` menguji kelas murni (validasi JSON, nomor HP, plat, waktu WIB,
rupiah, aturan status SPK dan booking, batas mekanik, token, bcrypt, env), dan
`tests/Feature` menyalakan seluruh pipa HTTP Laravel dengan repository sesi
tiruan untuk membuktikan urutan 413/400 → 401 → 403 → 422 dan matriks peran.

```sh
composer test            # PHPUnit
composer format-check    # Pint: gaya kode (composer format untuk merapikan)
```

Tes `bengkel:migrate` terhadap MySQL sungguhan
(`tests/Feature/MigrasiMySqlTest.php`) dilewati kecuali `TEST_DATABASE_URL`
diisi. Pakai database **kosong** yang dibuat khusus: tes menjalankan semua
migration di sana lalu menghapus semua tabelnya, dan menolak berjalan bila
database itu sudah berisi tabel.

```sh
# Sekali, sebagai root: CREATE DATABASE bengkel_tes_migrasi CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
TEST_DATABASE_URL=mysql://root:root@127.0.0.1:3350/bengkel_tes_migrasi composer test
```

<!-- kemas:abaikan-mulai -->
**Tes kontrak** (`../tests/kontrak`, Vitest) menembak backend sungguhan dan
memvalidasi setiap balasan terhadap spec. Skrip di bawah menyalakan backend
dengan env uji (`bengkel:serve`), menjalankan Vitest, lalu mematikan backend.
Database uji harus sudah dimigrasi (`docker compose run --rm migrate-uji-laravel up`);
WhatsApp palsu dinyalakan harness sendiri bila belum hidup.

```sh
# Dari folder project:
backend-laravel/scripts/uji-kontrak.sh                                  # semua berkas, :8882, bengkel_uji_laravel
backend-laravel/scripts/uji-kontrak.sh bengkel_uji_laravel 8882 8892 tes/outlet.test.ts

# Setup yang mati: backend dan harness sama-sama dengan SETUP_TOKEN kosong.
SETUP_TOKEN= backend-laravel/scripts/uji-kontrak.sh bengkel_uji_laravel 8882 8892 tes/setup.test.ts

# Suite lengkap di server yang melayani permintaan bersamaan (Nginx + php-cgi).
backend-laravel/scripts/uji-serentak.sh                                 # semua berkas, termasuk tes serentak
```

Log backend uji ada di `storage/logs/api-8882.log` (`uji-kontrak.sh`) atau
`storage/logs/nginx-uji-8882/logs/` (`uji-serentak.sh`).
<!-- kemas:abaikan-selesai -->

## Batasan server bawaan PHP

`php -S` (yang dipakai `bengkel:serve`) melayani **satu permintaan
sekaligus**. Itu cukup untuk dev, tetapi:

- satu permintaan lambat (WhatsApp sampai 10 detik) menahan semua permintaan
  lain;
- penguncian serentak (nomor SPK dan booking, stok terakhir, batas 3 booking
  menunggu, setup bersamaan, dua pemilik terakhir) baru terbukti di server yang
  benar-benar melayani permintaan paralel. Kode backend sudah mengunci baris
  dengan `SELECT … FOR UPDATE` dalam urutan yang sama di semua rute; yang
  tidak bisa dibuktikan `php -S` hanyalah keserentakannya;
- `PHP_CLI_SERVER_WORKERS` tidak ada di Windows.

<!-- kemas:abaikan-mulai -->
`scripts/uji-serentak.sh` menyusun Nginx dengan blok `upstream` berisi
beberapa proses `php-cgi` (`least_conn`, `PHP_FCGI_MAX_REQUESTS=0`, OPcache,
`enable_post_data_reading=0`), meniru Nginx + PHP-FPM di Windows. Di Laragon,
Nginx ada di `C:/laragon/bin/nginx/nginx-*/nginx.exe` dan `php-cgi.exe` di folder
PHP yang sama; di tempat lain isi env `NGINX` dan `PHP_CGI`.
<!-- kemas:abaikan-selesai -->

## Produksi: Nginx + PHP-FPM

Untuk produksi pakai Nginx + PHP-FPM (bukan `php -S`). Hal yang wajib:

- **PHP-FPM**: di konfigurasi pool pasang
  `php_admin_value[enable_post_data_reading] = 0` (backend membaca badan mentah
  sendiri supaya JSON rusak dinilai persis seperti kontrak; pengaturan ini
  `PHP_INI_PERDIR`, jadi tidak bisa dipasang lewat `ini_set`), lalu
  `php_admin_flag[display_errors] = off`, `php_admin_flag[log_errors] = on`, dan
  `php_admin_value[error_log] = /var/log/php-fpm/bengkel-error.log`. Tanpa itu,
  peringatan PHP seperti "Input variables exceeded 1000" ditulis ke depan badan
  JSON sebelum kode aplikasi sempat berjalan.
- **Env** diberikan ke pool (`env[PORT] = …`, `env[DATABASE_URL] = …`, dan
  seterusnya, atau berkas `.env` di folder backend-laravel), lalu jalankan
  `php artisan bengkel:periksa` dengan env yang sama setiap kali memasang atau
  mengubah env.
- **Nginx**: `root /…/backend-laravel/public;`, semua path diteruskan ke
  `index.php` (`try_files $uri /index.php?$query_string;` cukup karena folder
  `public` hanya berisi `index.php`), dan `client_max_body_size 1m` (batas yang
  sama juga ditegakkan aplikasi).
- **Rate limit** per alamat IP di Nginx yang menghadap internet, **di depan
  web** (backend hanya melihat satu alamat IP: server web): halaman dan BFF
  booking publik (`/booking`, `POST` booking publik), halaman lacak
  `/servis/*`, `/admin/masuk`, dan `/admin/setup`. Aplikasi tidak menyimpan
  catatan per IP; ini pagar utama terhadap booking iseng selain batas tiga
  booking menunggu per nomor HP dan penerimaan staf.
- **Log**: `LogAkses` dan `LogGalat` mencatat pola rute, bukan path asli,
  supaya token booking dan token lacak tidak masuk log. Log akses Nginx sendiri
  mencatat path; matikan atau samarkan untuk lokasi `/api/public/`.
- **Pemasangan awal**: kosongkan `SETUP_TOKEN` sesudah akun pemilik dibuat.

## WhatsApp: Fonnte sungguhan

Selama dev dan tes, `WA_API_URL` menunjuk ke WhatsApp palsu (`tests/wa-palsu`)
yang menampilkan pesan di browser dan tidak pernah mengirim ke WhatsApp
sungguhan. Untuk memakai Fonnte:

1. Daftar di Fonnte, hubungkan nomor WhatsApp bengkel sebagai perangkat, lalu
   salin token perangkatnya.
2. Isi `WA_API_URL=https://api.fonnte.com/send` dan `WA_TOKEN=<token
   perangkat>` (tanpa `Bearer`), lalu nyalakan ulang backend (atau muat ulang
   pool PHP-FPM) dan jalankan `php artisan bengkel:periksa`.
3. Buat satu SPK untuk nomor sendiri: pesan "SPK dibuat" harus tiba, dan
   `wa.workOrderCreated.status` di rincian SPK `sent`.

Backend mengirim `multipart/form-data` dengan tepat dua field (`target`,
`message`) dan menganggap pesan terkirim hanya bila balasan HTTP 2xx **dan**
JSON-nya `"status": true` (Fonnte membalas kegagalan dengan HTTP 200). Pesan
gagal tercatat di `wa_messages` beserta alasannya (token disamarkan `***`),
dan kasir bisa mengirim ulang pesan SPK dari rincian SPK. Pesan booking yang
gagal tidak punya rute kirim ulang: staf menghubungi pelanggan sendiri.
Penyedia lain dengan bentuk API berbeda cukup disesuaikan di
`app/Support/WhatsApp/WhatsAppClient.php`.

## Memecahkan masalah

| Gejala | Penyebab dan cara memperbaiki |
|---|---|
| `bengkel:serve` berhenti dengan `konfigurasi tidak sah: …` | env yang disebut namanya kosong atau tidak sah; isi di `.env` atau shell |
| `database tidak bisa dihubungi atau ditolak (galat 1045)` | sandi `DATABASE_URL` salah (1045), server mati (2002), atau database belum ada atau tanpa akses (1044/1049) |
| `database … baru punya N dari 16 tabel` | jalankan migration: `docker compose run --rm migrate-dev up` atau `php artisan bengkel:migrate` |
| `bengkel:migrate` gagal: `server database ini MariaDB` atau `terlalu lama` | pasang MySQL 8 (disarankan 8.4); "MySQL" bawaan XAMPP sebenarnya MariaDB |
| semua rute 500 sesudah `config:cache` | `php artisan config:clear`; lihat peringatan di bagian Konfigurasi |
| `Address already in use` | port `PORT` sudah dipakai proses lain; ganti `PORT` atau matikan prosesnya |
| setiap permintaan yang menyentuh database lambat ±2 detik (Windows) | `DATABASE_URL` memakai `localhost`; ganti hostnya jadi `127.0.0.1` |
