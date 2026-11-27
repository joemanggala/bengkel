# Menjalankan aplikasi bengkel secara lokal

Panduan ini mencakup fondasi yang dipakai bersama semua backend: MySQL, migration, pemilik
pertama, dan lint kontrak API. Perintah ditulis untuk Git Bash di Windows; di macOS/Linux sama
persis. Jalankan dari folder project (mis. `D:\KODE_PRODUK\bengkel`) kecuali disebut lain.

> **Status:** MySQL, migration, dan lint kontrak sudah bisa dijalankan (Bagian 0a). WhatsApp
> palsu dan tes kontrak ditambahkan Bagian 0b; backend Laravel (Bagian 1) dan web (Bagian 2)
> menyusul. Pembagian bagian ada di `docs/rancangan.md`.

## Prasyarat

| Alat | Versi |
|---|---|
| Docker Desktop | Compose v2 ke atas |
| Node.js | 20.17 ke atas (npm 10 ke atas), untuk lint kontrak dan tes |

## Port lokal

| Layanan | Dev | Tes kontrak |
|---|---|---|
| MySQL (kontainer, proyek compose `bengkel`) | **3350** → 3306 | 3350 |
| Backend Go (menyusul) | 8801 | 8881 (`bengkel_uji`) |
| Backend Laravel | 8802 | 8882 (`bengkel_uji_laravel`) |
| Backend NestJS (menyusul) | 8803 | 8883 (`bengkel_uji_nestjs`) |
| Web Next.js | 3800 | 3880 (bila perlu) |
| WhatsApp palsu | 8890 | 8891 (Go), 8892 (Laravel), 8893 (NestJS) |

MySQL sengaja tidak memakai 3306 (Laragon, XAMPP), 3310 (laundry), 3320 (toko online), 3330
(kafe-resto), atau 3340 (SIAKAD) supaya tidak bentrok dengan MySQL lain yang sudah menyala di
laptop. Seri port 88xx juga tidak dipakai produk lain.

## 1. MySQL dan migration

```sh
docker compose up -d mysql
docker compose ps            # tunggu sampai STATUS mysql "(healthy)"
```

Saat volume masih kosong, `db/init/01-buat-database.sql` membuat empat database (`utf8mb4` /
`utf8mb4_0900_ai_ci`) dan memberi user `bengkel` akses penuh:

| Database | Untuk |
|---|---|
| `bengkel` | dev dan web |
| `bengkel_uji` | tes kontrak backend Go; isinya dikosongkan sebelum setiap berkas tes |
| `bengkel_uji_laravel`, `bengkel_uji_nestjs` | tes kontrak Laravel dan NestJS, supaya suite bisa berjalan bersamaan |

Kredensial lokal: user aplikasi `bengkel` / `bengkel`, root `root`. Keduanya hanya untuk
kontainer di laptop (port diikat ke `127.0.0.1`).

Migration memakai golang-migrate dari kontainer (profil `alat`), jadi tidak perlu memasang apa
pun:

```sh
docker compose run --rm migrate-dev up          # database bengkel
docker compose run --rm migrate-uji up          # database bengkel_uji
docker compose run --rm migrate-uji-laravel up  # database bengkel_uji_laravel
docker compose run --rm migrate-uji-nestjs up   # database bengkel_uji_nestjs

docker compose run --rm migrate-dev version     # versi migration saat ini (sekarang 1)
docker compose run --rm migrate-uji down -all   # menghapus semua tabel (database uji saja)
```

Tanpa Docker (MySQL 8 yang dipasang biasa), jalankan `db/tanpa-docker.sql` sekali sebagai root,
arahkan `DATABASE_URL` backend ke MySQL itu, lalu pakai perintah migration bawaan backend (dibuat
Bagian 1, mis. `php artisan bengkel:migrate`). Perintah itu membaca `db/migrations` yang sama dan
mencatat versi di `schema_migrations` persis seperti golang-migrate, jadi kedua cara boleh
dipakai bergantian di satu database. MariaDB (termasuk "MySQL" bawaan XAMPP) tidak bisa dipakai.

| Versi | Isi |
|---|---|
| `000001_awal` | 16 tabel: `staff` (pemilik, kasir, mekanik), `staff_sessions`, `login_attempts` (batas percobaan masuk, dipakai backend Laravel), `outlet` (satu baris, nama "Nama Bengkel"), `customers`, `vehicles` (kunci plat unik), `services` (jasa), `parts` (sparepart, harga beli, stok), `counters` (penghitung nomor SPK dan booking), `work_orders` (SPK), `work_order_items`, `work_order_status_logs` (linimasa), `payments`, `stock_movements` (kartu stok), `bookings`, `wa_messages`. Ditambah tabel `schema_migrations` milik golang-migrate |

Skema hanya berasal dari `db/migrations`. Tidak ada backend yang boleh punya migration sendiri.
Kontainer MySQL dipakai bersama semua bagian project: jangan `docker compose down -v`
(menghapus volume beserta semua data) tanpa kesepakatan.

Migration juga menjaga aturan bisnis lewat `CHECK`, `UNIQUE`, dan `FOREIGN KEY`, jadi bila satu
backend lupa memvalidasi, database tetap menolak. Contohnya: total SPK harus sama dengan
subtotal jasa + subtotal part, terbayar tidak boleh melebihi total, SPK `PICKED_UP` harus lunas,
SPK batal tidak boleh punya pembayaran, stok sparepart tidak pernah negatif, tanda jumlah kartu
stok harus sesuai jenisnya, hanya perpindahan status yang sah yang bisa masuk ke linimasa,
kendaraan di SPK harus milik pelanggan SPK itu, plat tampilan harus sama dengan kunci plat tanpa
spasi, dan booking `CONVERTED` harus menunjuk tepat satu SPK.

### Database lain untuk percobaan

Database uji tambahan cukup dibuat sekali, lalu dimigrasi dengan runner yang sama. Nama harus
berawalan `bengkel_uji_` supaya harness tes kontrak (Bagian 0b) mau memakainya:

```sh
docker compose exec -T mysql mysql -uroot -proot -e \
  "CREATE DATABASE bengkel_uji_coba CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   GRANT ALL PRIVILEGES ON bengkel_uji_coba.* TO 'bengkel'@'%';"
MSYS_NO_PATHCONV=1 docker compose run --rm --entrypoint migrate migrate-uji \
  -path=/migrations "-database=mysql://bengkel:bengkel@tcp(mysql:3306)/bengkel_uji_coba?multiStatements=true" up
```

`MSYS_NO_PATHCONV=1` hanya perlu di Git Bash, supaya `/migrations` tidak diubah menjadi path
Windows. Database E2E (`bengkel_e2e_*`) dan review (`bengkel_review_*`) dibuat dengan cara yang
sama oleh bagian yang memakainya.

## 2. Pemilik pertama

Akun staf pertama (pemilik) dibuat sekali lewat `POST /api/setup`, bukan lewat SQL (SQL tidak
bisa membuat hash bcrypt). Endpoint ini hanya hidup bila env `SETUP_TOKEN` backend diisi
(minimal 16 byte, nilai acak sendiri seperti hasil `openssl rand -hex 16`), dan hanya selama
tabel `staff` masih kosong. Web menampilkan halaman pasang awal bila `GET /api/setup` membalas
`needsSetup: true`.

```sh
curl -X POST http://localhost:8802/api/setup -H 'Content-Type: application/json' \
  -d '{"token":"<isi SETUP_TOKEN>","name":"Pemilik","email":"pemilik@contoh.id","password":"<sandi minimal 8>"}'
```

Sesudah pemilik pertama ada, kosongkan lagi `SETUP_TOKEN` di server produksi. Pemilik membuat
akun kasir dan mekanik dari web, lalu mengisi profil outlet, jasa, dan sparepart.

## 3. Lint kontrak API

Kontrak API ada di `spec/openapi.yaml` (dipecah ke `spec/paths/` dan `spec/components/`) dan
harus lolos lint dengan 0 galat dan 0 peringatan. Contoh respons di spec ikut diperiksa terhadap
skemanya (aturan `no-invalid-media-type-examples` dinaikkan menjadi galat di
`spec/redocly.yaml`).

```sh
npx --yes @redocly/cli@1.34.20 lint spec/openapi.yaml --config spec/redocly.yaml
```

Versi redocly dipatok sama dengan produk lain supaya cache npm terpakai. Bagian 0b menambahkan
perintah yang sama sebagai `npm run lint-spec` di `tests/kontrak`, bersama WhatsApp palsu dan
tes kontrak (bagian berikutnya panduan ini ditulis di sana).
