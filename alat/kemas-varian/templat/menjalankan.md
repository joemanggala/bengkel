# Menjalankan aplikasi bengkel

Panduan ini mencakup fondasi untuk mencoba aplikasi di laptop: MySQL, migration, pemilik
pertama, WhatsApp palsu, WhatsApp sungguhan, dan syarat sebelum produksi. Perintah ditulis untuk
Git Bash di Windows; di macOS/Linux sama persis. Jalankan dari folder paket ini (tempat
`docker-compose.yml` berada) kecuali disebut lain. Paket ini memuat backend {{nama}}; cara
menjalankan dan memasangnya di server ada di `{{folder}}/README.md`, dan pengaturan web ada di
`web/.env.example`.

## Prasyarat

| Alat | Versi |
|---|---|
| MySQL | **8.0 ke atas** (disarankan 8.4 LTS) yang dipasang biasa (bagian 1, Cara A); atau Docker Desktop dengan Compose v2, yang menyalakan MySQL 8.4 di kontainer (Cara B) |
| Node.js | 20.17 ke atas (npm 10 ke atas), untuk web dan WhatsApp palsu |
{{#laravel}}
| PHP | 8.4 (ekstensi pdo_mysql, mbstring, openssl, curl; OPcache dianjurkan) |
| Composer | 2 |
{{/laravel}}

## Port lokal

| Layanan | Port |
|---|---|
| MySQL yang dipasang sendiri (Cara A) | umumnya 3306 |
| MySQL kontainer (Cara B, proyek compose `bengkel`) | **{{portMysql}}** → 3306 |
| Backend {{nama}} | {{port}} |
| Web Next.js | {{portWeb}} |
| WhatsApp palsu | {{portWa}} |

MySQL kontainer sengaja tidak memakai 3306 supaya tidak bentrok dengan MySQL lain yang sudah
menyala di laptop. `DATABASE_URL` di `{{folder}}/.env.example` memakai port kontainer
({{portMysql}}); pemakai Cara A menggantinya ke port MySQL-nya sendiri.

## 1. MySQL dan migration

Aplikasi butuh MySQL 8 dengan database `bengkel`, lalu tabelnya dibuat oleh migration dari
`db/migrations`. Pilih salah satu cara. **Cara A** memakai MySQL yang dipasang biasa, tanpa
Docker; ini yang paling mudah di Windows. **Cara B** memakai Docker Desktop. Hasil keduanya sama,
dan versi migration dicatat di tabel yang sama (`schema_migrations`), jadi satu database boleh
dimigrasi bergantian dengan kedua cara.

### Cara A: tanpa Docker

1. Pasang **MySQL Community Server 8.0 ke atas** (disarankan 8.4 LTS, sama dengan kontainer)
   seperti aplikasi biasa, dan catat sandi root yang kamu buat saat memasang. MySQL 8 yang
   dibawa Laragon juga bisa. **MariaDB tidak bisa dipakai, termasuk "MySQL" bawaan XAMPP**:
   skema memakai collation `utf8mb4_0900_ai_ci` dan `REGEXP_LIKE` di `CHECK` yang hanya ada di
   MySQL 8. Perintah migration menolak MariaDB dengan pesan yang jelas.
2. Sebagai root, jalankan `db/tanpa-docker.sql` sekali. Berkas ini membuat database `bengkel`
   dan user `bengkel` / `bengkel`, sama dengan kontainer, dan aman dijalankan ulang. Dari folder
   paket, lalu ketik sandi root saat diminta:

   ```sh
   "/c/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe" -u root -p -e "source db/tanpa-docker.sql"
   ```

   Sesuaikan `8.4` dengan versi yang terpasang; bila `mysql` sudah ada di PATH, cukup
   `mysql -u root -p -e "source db/tanpa-docker.sql"`. Bisa juga lewat MySQL Workbench atau
   HeidiSQL: buka berkasnya, lalu jalankan semuanya. Bila mengetik `source` di dalam klien
   `mysql`, tulis lokasinya dengan garis miring `/` (mis. `source C:/bengkel/db/tanpa-docker.sql`):
   garis miring terbalik di `\tanpa-docker.sql` terbaca sebagai tab.

**3.** Siapkan folder backend dan `.env`-nya:

```sh
{{siapkan}}
```

Di `{{folder}}/.env`, ganti port di `DATABASE_URL` ke port MySQL-mu, umumnya 3306:
`DATABASE_URL=mysql://bengkel:bengkel@127.0.0.1:3306/bengkel`. Tulis `127.0.0.1`, bukan
`localhost`: di Windows PHP butuh ±2 detik di setiap koneksi hanya untuk menerjemahkan nama
`localhost`. Isi juga `SETUP_TOKEN` (bagian 2).

**4.** Masih dari folder `{{folder}}`, buat tabelnya:

```sh
{{migrasi}}
{{migrasiArg}} versi
```

Baris pertama menjalankan semua migration yang belum; baris kedua menampilkan versi database
(sekarang 1). Perintah ini membaca `db/migrations` yang sama dan mencatat versinya di tabel yang
sama dengan golang-migrate di Cara B. Jalankan lagi setiap kali memasang versi paket yang lebih
baru; migration yang sudah jalan tidak diulang. Bila sebuah migration gagal di tengah jalan,
database berstatus kotor dan migration berikutnya ditolak: perbaiki penyebabnya, lalu tetapkan
versinya dengan `{{migrasiArg}} paksa N`. Di laptop, cara termudah mengulang dari awal adalah
menghapus database `bengkel` (`DROP DATABASE bengkel;` sebagai root), menjalankan
`db/tanpa-docker.sql` lagi, lalu migration. Perintah ini hanya naik versi.

### Cara B: Docker

```sh
docker compose up -d mysql
docker compose ps            # tunggu sampai STATUS mysql "(healthy)"
```

Saat volume masih kosong, `db/init/01-buat-database.sql` membuat database `bengkel`
(`utf8mb4` / `utf8mb4_0900_ai_ci`) dan memberi user `bengkel` akses penuh. Kredensial lokal: user
aplikasi `bengkel` / `bengkel`, root `root`. Keduanya hanya untuk kontainer di laptop; di server,
buat user dan sandi sendiri.

Migration memakai golang-migrate dari kontainer (profil `alat`), jadi tidak perlu memasang apa pun:

```sh
docker compose run --rm migrate-dev up          # database bengkel
docker compose run --rm migrate-dev version     # versi migration saat ini (sekarang 1)
```

Untuk mengulang dari database kosong, hapus volumenya: `docker compose down -v`, lalu
`docker compose up -d mysql` dan `docker compose run --rm migrate-dev up` lagi. Jangan
`docker compose down -v` (menghapus volume beserta semua data) kecuali kamu memang ingin memulai
dari database kosong.

### Daftar migration

| Versi | Isi |
|---|---|
| `000001_awal` | 16 tabel: `staff` (pemilik, kasir, mekanik), `staff_sessions`, `login_attempts` (batas percobaan masuk), `outlet` (satu baris, nama "Nama Bengkel"), `customers`, `vehicles` (kunci plat unik), `services` (jasa), `parts` (sparepart, harga beli, stok), `counters` (penghitung nomor SPK dan booking), `work_orders` (SPK), `work_order_items`, `work_order_status_logs` (linimasa), `payments`, `stock_movements` (kartu stok), `bookings`, `wa_messages`. Ditambah tabel pencatat versi `schema_migrations` |

Skema hanya berasal dari `db/migrations`; `{{migrasi}}` (Cara A) dan golang-migrate (Cara B)
menjalankan berkas yang sama, dan backend tidak punya migration lain.

Migration juga menjaga aturan bisnis lewat `CHECK`, `UNIQUE`, dan `FOREIGN KEY`, jadi bila kode
lupa memvalidasi, database tetap menolak. Contohnya: total SPK harus sama dengan subtotal jasa +
subtotal part, terbayar tidak boleh melebihi total, SPK yang diambil harus lunas, SPK batal tidak
boleh punya pembayaran, stok sparepart tidak pernah negatif, hanya perpindahan status yang sah
yang bisa masuk ke linimasa, dan kendaraan di SPK harus milik pelanggan SPK itu.

## 2. Pemilik pertama

Akun staf pertama (pemilik) dibuat sekali lewat `POST /api/setup`, bukan lewat SQL (SQL tidak
bisa membuat hash bcrypt). Endpoint ini hanya hidup bila env `SETUP_TOKEN` backend diisi
(minimal 16 byte, nilai acak sendiri seperti hasil `openssl rand -hex 16`; `.env.example`
sengaja mengosongkannya dan nilai contoh dari dokumentasi ditolak saat backend menyala), dan
hanya selama tabel `staff` masih kosong. Web menampilkan halaman pemasangan awal bila
`GET /api/setup` membalas `needsSetup: true`, jadi biasanya kamu tidak perlu memanggilnya
sendiri. Lewat perintah:

```sh
curl -X POST http://localhost:{{port}}/api/setup -H 'Content-Type: application/json' \
  -d '{"token":"<isi SETUP_TOKEN>","name":"Pemilik","email":"pemilik@contoh.id","password":"<sandi minimal 8>"}'
```

Sesudah pemilik pertama ada, kosongkan lagi `SETUP_TOKEN` di server produksi. Pemilik membuat
akun kasir dan mekanik dari web, lalu mengisi profil outlet, jasa, dan sparepart.

## 3. WhatsApp palsu

`tests/wa-palsu` (Node + TypeScript, hanya `node:http`) meniru API kirim Fonnte (`POST /send`,
lihat `spec/whatsapp.md`). Pesan disimpan di memori dan tidak pernah sampai ke WhatsApp
sungguhan. Nyalakan sebelum backend, lalu arahkan backend ke sini:

```sh
cd tests/wa-palsu
npm ci
npm start          # http://localhost:{{portWa}} (kirim ke /send)
npm test
npm run typecheck
```

Env (opsional): `WA_PALSU_PORT` ({{portWa}}), `WA_TOKEN` (isi header `Authorization` yang
diterima; nilai bawaannya sama dengan `WA_TOKEN` di `{{folder}}/.env.example`), `WA_PALSU_HOST`.
Backend dev memakai `WA_API_URL=http://localhost:{{portWa}}/send` dan `WA_TOKEN` yang sama;
keduanya sudah terisi di `{{folder}}/.env.example`.

**Melihat pesan saat mencoba di laptop:** konfirmasi atau tolak booking, buat SPK, tandai SPK
Selesai, atau kirim nota dari rincian SPK, lalu buka <http://localhost:{{portWa}}>. Pesan
dikelompokkan per nomor tujuan (nomor terbaru di atas), dan halaman memuat ulang setiap 5 detik.
Klik nomor untuk hanya melihat pesan nomor itu (`/?nomor=628…`). Tombol "Kosongkan" menghapus
semua pesan. Booking dari website sendiri tidak mengirim WhatsApp; pesan pertama dikirim saat staf
mengonfirmasi atau menolaknya.

| Rute | Perilaku |
|---|---|
| `POST /send` | tiruan Fonnte. Header `Authorization` bukan `WA_TOKEN` persis (termasuk berawalan `Bearer`) → 200 `{"Status": false, "reason": "token invalid", "requestid"}`. Badan bukan `multipart/form-data`, field selain tepat satu `target` dan satu `message` (teks), atau `message` kosong → 200 `{"reason": "input invalid", "status": false, "requestid"}`. `target` bukan satu nomor `628…` → `target invalid`. Sah → 200 `{"detail": "success! message in queue", "id": ["<n>"], "process": "pending", "requestid", "status": true, "target": ["628…"]}` dan pesan tersimpan |
| `GET /` | halaman pesan per nomor (HTML); `?nomor=628…` hanya satu nomor |
| `GET /__kendali/ping` | `{"ok": true, "layanan": "wa-palsu", "jalur": "/send", "sidikToken"}`; `sidikToken` = hex SHA-256 token yang diterima (bukan tokennya) |
| `POST /__kendali/reset` | mengosongkan pesan, catatan permintaan, gangguan, dan jeda, serta mengulang nomor dari 1 |
| `GET /__kendali/pesan?to=628…` | `{"data": [...]}`: pesan yang diterima untuk nomor itu (tanpa `to` = semua), urut dari yang pertama masuk |
| `GET /__kendali/permintaan` | `{"data": [...]}`: semua permintaan ke `/send`, termasuk yang ditolak, dengan alasannya. Token tidak dicatat. Tempat pertama yang dibaca bila pesan tidak tiba |

Dua rute kendali lain, `POST /__kendali/gangguan` dan `POST /__kendali/jeda`, membuat WhatsApp
palsu pura-pura gagal atau lambat untuk mencoba bagaimana backend bersikap saat penyedia
bermasalah; lihat `tests/wa-palsu/src/server.ts` untuk bentuk badannya.

## 4. WhatsApp sungguhan untuk produksi

Kunci asli tidak pernah ditulis di repo atau `.env.example`. Isi hanya di env server (atau
pengelola rahasia), dan jangan dicetak ke log.

1. Daftar di penyedia yang memakai bentuk API kirim Fonnte (mis. <https://fonnte.com>),
   sambungkan nomor WhatsApp bengkel dengan memindai kode QR dari dashboard penyedia, lalu salin
   token perangkatnya.
2. Isi env backend, lalu nyalakan ulang backend:

   ```sh
   WA_API_URL=https://api.fonnte.com/send
   WA_TOKEN=<token perangkat dari dashboard penyedia>
   PUBLIC_WEB_URL=https://<alamat web bengkel>
   ```

3. Buat SPK untuk nomor HP sendiri: pesan "SPK dibuat" harus tiba, dan kartu WhatsApp di rincian
   SPK menampilkan "Terkirim". Bila pesan tidak masuk, lihat baris terbaru `wa_messages`
   (`status`, `failure_reason`) dan log pengiriman di dashboard penyedia.

Backend menganggap pesan terkirim hanya bila balasan HTTP 2xx **dan** JSON-nya `"status": true`
(Fonnte membalas kegagalan dengan HTTP 200). Pesan SPK yang gagal bisa dikirim ulang kasir dari
rincian SPK; pesan booking yang gagal tidak punya tombol kirim ulang, jadi staf menghubungi
pelanggan sendiri. Penyedia dengan bentuk API lain cukup disesuaikan di satu tempat: klien
WhatsApp di backend. Integrasi ini **belum diuji dengan akun Fonnte sungguhan**.

## 5. Syarat sebelum produksi

Aplikasi tidak memeriksanya sendiri, tetapi semuanya wajib ada sebelum layanan dibuka ke
internet.

- **Rate limit di Nginx yang menghadap internet, di depan web** (bukan di depan backend).
  Pelanggan tidak memanggil backend langsung: browser berbicara ke web, dan server web memanggil
  backend dari server yang sama, sehingga backend hanya melihat satu alamat IP. Rute yang bisa
  dipanggil siapa saja: halaman dan BFF booking publik (`/booking`, `/bff/public/*`, terutama
  pembuatan booking), halaman lacak `/servis/*`, serta `/admin/masuk` dan `/admin/setup` (masuk
  dan pemasangan awal). Batas tiga booking menunggu per nomor HP dan batas percobaan masuk per
  email hanya pengaman terakhir di backend, bukan pengganti rate limit. Contoh konfigurasi
  lengkap ada di Panduan Upload ke VPS (`docs/panduan`).
- **Backend di Nginx + PHP-FPM**, bukan server bawaan PHP. Pengaturan pool yang wajib
  (`enable_post_data_reading`, `display_errors`, log galat) ada di `{{folder}}/README.md`.
- **Log akses Nginx** dimatikan atau disamarkan untuk lokasi `/api/public/`, `/booking/`, dan
  `/servis/`, karena path-nya memuat token booking dan token lacak pelanggan.
- **`SETUP_TOKEN` dikosongkan** setelah pemilik pertama dibuat.
- **`PUBLIC_WEB_URL`** diisi alamat web produksi, karena tautan lacak dan tautan booking di pesan
  WhatsApp dirangkai dari situ.
- **`API_URL` web** diisi alamat backend produksi dan **`COOKIE_SECURE=true`** bila web dilayani
  lewat HTTPS.
- **Cadangan database** berkala, dan pembersihan `staff_sessions` yang lewat `expires_at` serta
  `wa_messages` lama bila tabelnya membesar.

## Memecahkan masalah

| Gejala | Penyebab dan perbaikan |
|---|---|
| Backend berhenti saat dinyalakan dan pesannya menyebut nama env | env wajib kosong atau nilainya tidak sah, mis. `SETUP_TOKEN` kurang dari 16 byte atau masih nilai contoh dari dokumentasi (isi hasil `openssl rand -hex 16`). Perbaiki di `{{folder}}/.env`; isi env tidak pernah dicetak di pesan |
| Backend tidak bisa terhubung ke database | MySQL belum menyala atau port di `DATABASE_URL` salah. Cara A: nyalakan layanan MySQL (Windows: aplikasi Services, layanan `MySQL84` atau sejenisnya) dan pastikan portnya sama, umumnya 3306. Cara B: `docker compose up -d mysql`, lalu tunggu `docker compose ps` menampilkan `(healthy)` |
| Galat karena tabel tidak ada, atau database `bengkel` punya kurang dari 16 tabel | migration belum dijalankan sampai versi terbaru. Cara A: `{{migrasi}}` dari folder `{{folder}}`. Cara B: `docker compose run --rm migrate-dev up` |
| `{{migrasi}}` menyebut "server database ini MariaDB" | MySQL bawaan XAMPP sebenarnya MariaDB dan tidak bisa dipakai. Pasang MySQL 8, atau pakai Cara B (Docker) |
| `{{migrasi}}` menyebut `Access denied` atau `Unknown database` | `db/tanpa-docker.sql` belum dijalankan sebagai root, atau user, sandi, atau nama database di `DATABASE_URL` berbeda dari isi berkas itu |
| `source db/tanpa-docker.sql` gagal "Failed to open file" | jalankan perintahnya dari folder paket, atau tulis lokasi lengkap dengan garis miring `/`, bukan `\` |
| `'mysql' is not recognized` atau `mysql: command not found` | `mysql` belum ada di PATH. Panggil lewat lokasi lengkapnya, mis. `"/c/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe"`, atau pakai MySQL Workbench |
| Setiap halaman lambat ±2 detik (Windows) | `DATABASE_URL` memakai `localhost`; ganti hostnya menjadi `127.0.0.1` |
| `GET /api/setup` tetap `needsSetup: true` padahal pemilik sudah dibuat | backend membaca database lain; periksa `DATABASE_URL` di `{{folder}}/.env` (bawaannya database `bengkel`) |
| `POST /api/setup` membalas 403 `setup_disabled` | `SETUP_TOKEN` backend kosong (bawaan paket); isi nilai acak, mis. hasil `openssl rand -hex 16`, lalu nyalakan ulang backend |
| Web tidak bisa memuat data atau menampilkan galat koneksi | backend belum menyala, atau `API_URL` di `web/.env.local` salah (di paket ini `http://localhost:{{port}}`) |
| Pesan tidak muncul di <http://localhost:{{portWa}}> | backend tidak mengirim, `WA_API_URL` backend menunjuk ke tempat lain dari `http://localhost:{{portWa}}/send`, atau pesan dikirim ke nomor lain. Baca <http://localhost:{{portWa}}/__kendali/permintaan>: semua permintaan ke WhatsApp palsu tercatat di sana, termasuk yang ditolak |
| WhatsApp palsu membalas `token invalid` | `WA_TOKEN` backend tidak sama dengan `WA_TOKEN` WhatsApp palsu; samakan keduanya |
| Tautan lacak di pesan WhatsApp tidak terbuka di HP pelanggan | `PUBLIC_WEB_URL` backend masih `http://localhost:{{portWeb}}`; isi alamat web yang bisa dijangkau HP |
| Kirim ulang pesan WhatsApp membalas 503 `wa_unavailable` | penyedia WhatsApp menolak atau tidak terjangkau: periksa `WA_API_URL` dan `WA_TOKEN`, lalu lihat baris terbaru tabel `wa_messages` (`status`, `failure_reason`) dan log pengiriman di dashboard penyedia |
