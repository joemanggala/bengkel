# Menjalankan aplikasi bengkel secara lokal

Panduan ini mencakup fondasi yang dipakai bersama semua backend: MySQL, migration, pemilik
pertama, dan lint kontrak API. Perintah ditulis untuk Git Bash di Windows; di macOS/Linux sama
persis. Jalankan dari folder project (mis. `D:\KODE_PRODUK\bengkel`) kecuali disebut lain.

> **Status:** MySQL, migration, dan lint kontrak (Bagian 0a), WhatsApp palsu dan harness tes
> kontrak (Bagian 0b) sudah bisa dijalankan. Backend Laravel (Bagian 1) dan web (Bagian 2)
> menyusul; sebelum ada backend, `npm test` di `tests/kontrak` berhenti dengan pesan "Backend
> tidak bisa dihubungi di …". Pembagian bagian ada di `docs/rancangan.md`.

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

## 3. WhatsApp palsu

`tests/wa-palsu` (Node + TypeScript, hanya `node:http`) meniru API kirim Fonnte (`POST /send`,
lihat `spec/whatsapp.md`). Pesan disimpan di memori dan tidak pernah sampai ke WhatsApp
sungguhan. Tes kontrak menyalakannya sendiri bila belum hidup; untuk dev, nyalakan manual lalu
arahkan backend ke sini:

```sh
cd tests/wa-palsu
npm ci
npm start          # http://localhost:8890 (backend mengirim ke /send)
npm test           # 37 tes sendiri
npm run typecheck
```

Env (opsional): `WA_PALSU_PORT` (8890; tes kontrak 8891 Go, 8892 Laravel, 8893 NestJS; E2E
8814-8816), `WA_TOKEN` (`token-wa-uji-bengkel-bukan-kunci-asli`, isi header `Authorization`
yang diterima), `WA_PALSU_HOST`. Backend dev memakai `WA_API_URL=http://localhost:8890/send`
dan `WA_TOKEN` yang sama.

**Melihat pesan saat mencoba di laptop:** buat SPK untuk pelanggan, tandai SPK Selesai,
konfirmasi atau tolak booking, atau kirim nota dari rincian SPK, lalu buka
<http://localhost:8890>. Pesan dikelompokkan per nomor tujuan (nomor terbaru di atas) dan
halaman memuat ulang setiap 5 detik. Klik nomor untuk hanya melihat pesan nomor itu
(`/?nomor=628…`). Tombol "Kosongkan" menghapus semua pesan.

| Rute | Perilaku |
|---|---|
| `POST /send` | tiruan Fonnte. Header `Authorization` bukan `WA_TOKEN` persis (termasuk berawalan `Bearer`) → 200 `{"Status": false, "reason": "token invalid", "requestid"}`. Badan bukan `multipart/form-data`, field selain tepat satu `target` dan satu `message` (teks), atau `message` kosong → 200 `{"reason": "input invalid", "status": false, "requestid"}`. `target` bukan satu nomor `628…` (10–15 digit) → `target invalid`. Sah → 200 `{"detail": "success! message in queue", "id": ["<n>"], "process": "pending", "requestid", "status": true, "target": ["628…"]}` dan pesan tersimpan. Badan lebih dari 1 MiB → 413 |
| `GET /` | halaman pesan per nomor (HTML, isi di-escape); `?nomor=628…` hanya satu nomor |
| `GET /__kendali/ping` | `{"ok": true, "layanan": "wa-palsu", "jalur": "/send", "sidikToken"}`; `sidikToken` = hex SHA-256 token yang diterima (bukan tokennya) |
| `POST /__kendali/reset` | mengosongkan pesan, catatan permintaan, gangguan, dan jeda, serta mengulang nomor dari 1 |
| `GET /__kendali/pesan?to=628…` | `{"data": [...]}`: pesan yang diterima untuk nomor itu (tanpa `to` = semua), urut dari yang pertama masuk. Tiap pesan: `nomor`, `waktu`, `target`, `pesan` (CRLF sudah diganti LF) |
| `GET /__kendali/permintaan` | `{"data": [...]}`: semua permintaan ke `/send`, termasuk yang ditolak, dengan `tokenSah`, `contentType`, `field`, `fieldBerkas`, `hasil` (`diproses`, `terkirim`, `ditolak`, `gangguan`), `alasan`, `statusHttp`. Token tidak dicatat. Tempat pertama yang dibaca bila pesan tidak tiba |
| `POST /__kendali/gangguan` | `{"gagal": boolean, "nomor"?: "628…", "mode"?: "status-false" \| "http-500" \| "putus" \| "alasan-panjang" \| "gema-token"}`. Tanpa `nomor` berlaku untuk semua nomor; gangguan per nomor mengalahkan gangguan semua. `status-false` (bawaan) membalas HTTP 200 `"status": false`; `alasan-panjang` memberi `reason` 600 huruf non-ASCII (backend wajib memotong 255 code point); `gema-token` memantulkan header `Authorization` di `reason` (backend wajib menyamarkan `WA_TOKEN`) |
| `POST /__kendali/jeda` | `{"ms": 0..5000, "nomor"?: "628…"}`: menahan balasan `/send` selama `ms` milidetik; `ms: 0` mematikannya. Selama ditahan, permintaan tercatat `diproses` |

Tidak ada kode OTP di produk ini, jadi `/__kendali/pesan` tidak punya kolom kode. Penolakan
yang meniru Fonnte (HTTP 200 dengan `"status": false`) sengaja membuat backend yang hanya
memeriksa kode HTTP salah mencatat pesan gagal sebagai terkirim; tes kontrak menangkapnya.

## 4. Lint kontrak API

Kontrak API ada di `spec/openapi.yaml` (dipecah ke `spec/paths/` dan `spec/components/`) dan
harus lolos lint dengan 0 galat dan 0 peringatan. Contoh respons di spec ikut diperiksa terhadap
skemanya (aturan `no-invalid-media-type-examples` dinaikkan menjadi galat di
`spec/redocly.yaml`).

```sh
cd tests/kontrak
npm ci
npm run lint-spec        # sama dengan: npx --yes @redocly/cli@1.34.20 lint spec/openapi.yaml --config spec/redocly.yaml
```

Versi redocly dipatok sama dengan produk lain supaya cache npm terpakai. Galat YAML yang paling
sering: nilai `description:` satu baris yang memuat `: ` (titik dua + spasi), mis.
`Urutan: 401 → 404`. Tulis sebagai blok (`description: |`) atau beri tanda kutip.

## 5. Tes kontrak

Satu suite Vitest untuk ketiga backend; yang berbeda hanya alamat backend, database uji, dan
port WhatsApp palsunya.

```sh
cd tests/kontrak
npm ci
npm run cek-harness                        # tanpa backend (lihat di bawah)
npm run typecheck
BASE_URL=http://localhost:8882 npm test    # Laravel
```

`npm run cek-harness` membuktikan harness siap tanpa backend: database uji (`bengkel_uji`)
terhubung dan 16 tabelnya ada, pengaman menolak database dev, pengosongan memasukkan lagi baris
awal migration, WhatsApp palsu menolak token lain dan menyimpan pesan sah, fixtur bcrypt cocok,
penyusun pesan dan aturan nilai harness sama dengan **semua contoh yang dibaca langsung dari
spec** (7 contoh pesan di `whatsapp.md`, tabel plat dan nomor HP, samaran, pesan
`insufficient_stock`, label status), validator respons meloloskan semua contoh respons di spec
dan menolak kebocoran yang dilarang, dan setiap berkas kode milik Bagian 0 (`spec/`, `db/`,
`tests/`, `docker-compose.yml`) diawali header hak cipta dua baris dan memakai LF.

Ketiga backend memakai database uji dan WhatsApp palsu sendiri, jadi ketiga suite bisa berjalan
bersamaan. Bila `BASE_URL` memakai port uji 8881/8882/8883 dan `DATABASE_URL`/`WA_PALSU_URL`
tidak diisi, harness memilih pasangannya sendiri sesuai tabel ini; backend uji wajib memakai
baris yang sama:

| Backend | `BASE_URL` | `DATABASE_URL` harness dan backend | `WA_PALSU_URL` harness | `WA_API_URL` backend |
|---|---|---|---|---|
| Laravel | `http://localhost:8882` | `mysql://bengkel:bengkel@127.0.0.1:3350/bengkel_uji_laravel` | `http://localhost:8892` | `http://localhost:8892/send` |
| Go (menyusul) | `http://localhost:8881` | `…/bengkel_uji` | `http://localhost:8891` | `http://localhost:8891/send` |
| NestJS (menyusul) | `http://localhost:8883` | `…/bengkel_uji_nestjs` | `http://localhost:8893` | `http://localhost:8893/send` |

Urutan tes di dalam berkas boleh diacak: `npm test -- --sequence.shuffle`. Satu berkas saja:
`BASE_URL=http://localhost:8882 npx vitest run tes/kesehatan.test.ts`.

Sebelum tes dimulai, harness:

1. membundel spec, dan setiap respons kemudian divalidasi terhadapnya dengan Ajv (kode status,
   header wajib, media type, dan badan; objek respons tertutup). Daftar sparepart dinilai
   dengan skema milik peran peminta: kasir dan mekanik yang menerima `costPrice` gagal;
2. memastikan `DATABASE_URL` menunjuk ke `bengkel_uji` atau `bengkel_uji_<nama>` (selain itu
   ditolak) dan ke-16 tabel sudah dimigrasi (versi 1, tidak dirty);
3. memakai WhatsApp palsu yang sudah hidup di `WA_PALSU_URL` (token wajib sama, dibandingkan
   lewat `sidikToken`), atau menyalakannya di proses harness;
4. menunggu `GET {BASE_URL}/api/health` paling lama 30 detik; bila tidak ada jawaban, berhenti
   dengan "Backend tidak bisa dihubungi di …";
5. membuktikan backend membaca database uji yang sama: `GET /api/setup` wajib berubah dari
   `needsSetup: true` ke `false` setelah harness menyisipkan satu staf;
6. bila backend sudah bisa membuat pelanggan, kendaraan, dan SPK, memastikan pesan
   `work_order_created` benar-benar tiba di WhatsApp palsu. Bila backend membalas 201 tetapi
   pesannya tidak tiba, harness berhenti: `WA_API_URL` backend menunjuk ke penyedia lain, dan
   tes akan mengirim ratusan pesan WhatsApp sungguhan.

Sebelum setiap berkas tes, ke-16 tabel dikosongkan (`FOREIGN_KEY_CHECKS=0` + `TRUNCATE` dalam
satu koneksi), baris awal `outlet` ("Nama Bengkel") dan `counters` (`work_order_number` dan
`booking_number` = 0) dimasukkan lagi persis seperti migration, dan WhatsApp palsu di-reset.
Staf untuk tes disisipkan langsung ke database dengan hash bcrypt fixtur, lalu masuk lewat API.

### Env harness

Bisa ditulis di `tests/kontrak/.env` (tidak dilacak git; contoh di `.env.example`); env dari
shell selalu menang.

| Env | Bawaan |
|---|---|
| `BASE_URL` | wajib |
| `DATABASE_URL` | menurut port `BASE_URL` (tabel di atas), selain itu `mysql://bengkel:bengkel@127.0.0.1:3350/bengkel_uji`; hanya `bengkel_uji` dan `bengkel_uji_<nama>` yang diterima |
| `WA_PALSU_URL` | menurut port `BASE_URL`, selain itu `http://localhost:8891` |
| `WA_TOKEN` | `token-wa-uji-bengkel-bukan-kunci-asli`; wajib sama dengan backend |
| `SETUP_TOKEN` | `token-setup-uji-bengkel-bukan-rahasia`; wajib sama dengan backend. Diisi kosong (`SETUP_TOKEN=`) hanya untuk menguji setup yang mati |
| `PUBLIC_WEB_URL` | `http://localhost:3880`; wajib sama dengan backend (tautan `/servis/{token}` dan `/booking` di pesan WhatsApp dibandingkan huruf demi huruf) |
| `TUNGGU_BACKEND_DETIK` | 30 |

### Env wajib backend saat diuji

Ketiga backend membaca nama env yang sama (spec, "Env bersama backend"). Saat menjalankan tes
kontrak, backend **wajib** dinyalakan dengan nilai berikut (contoh Laravel di 8882):

```sh
PORT=8882
DATABASE_URL=mysql://bengkel:bengkel@127.0.0.1:3350/bengkel_uji_laravel
WA_API_URL=http://localhost:8892/send
WA_TOKEN=token-wa-uji-bengkel-bukan-kunci-asli
SETUP_TOKEN=token-setup-uji-bengkel-bukan-rahasia
PUBLIC_WEB_URL=http://localhost:3880
```

- `WA_API_URL` mengikuti port WhatsApp palsu backend itu (tabel di atas).
- Nilai rahasia di atas memang palsu dan hanya untuk uji.
- Tes serentak (nomor SPK, stok terakhir, batas booking, setup bersamaan) butuh backend yang
  benar-benar melayani permintaan bersamaan. Server bawaan PHP (`php artisan serve`) melayani
  satu permintaan sekaligus, jadi suite lengkap Laravel dijalankan di Nginx + PHP-FPM.

### Menguji setup yang mati

`POST /api/setup` membalas 403 `setup_disabled` bila `SETUP_TOKEN` backend kosong. Kasus ini
butuh backend yang dinyalakan ulang dengan `SETUP_TOKEN=` (kosong), lalu hanya berkas setup
yang dijalankan dengan `SETUP_TOKEN` harness juga kosong:

```sh
SETUP_TOKEN= BASE_URL=http://localhost:8882 npx vitest run tes/setup.test.ts
```

Pada jalan biasa (token diisi), tes setup-mati dilewati, dan sebaliknya. Backend dinyatakan
lulus bila suite hijau dengan token diisi **dan** berkas setup hijau dengan token kosong.

## 6. Hal kontrak yang mudah terlewat

Yang sama dengan produk KodeCoding lain (sudah teruji di tiga backend di sana):

- Token sesi staf dan token publik: 32 byte acak → base64url tanpa padding (43 karakter).
  `token_hash` dan `booking_token_hash` = SHA-256 hex huruf kecil atas string token itu.
  Header dibaca sebagai `Bearer` (tidak peka huruf) + tepat satu spasi + token.
- Semua env dipangkas sebelum dipakai; kosong sesudah dipangkas = tidak diisi. `WA_API_URL`
  alamat kirim lengkap dengan path; header ke penyedia `Authorization: <WA_TOKEN>` tanpa
  `Bearer`. Garis miring akhir `PUBLIC_WEB_URL` dibuang.
- Tidak ada CORS: `OPTIONS` dan `HEAD` → 404 seperti metode lain yang tidak tertulis. Rute
  dicocokkan lebih dulu dari 413/400/401.
- Boolean di respons wajib `true`/`false`; driver MySQL sering membaca kolom `BOOLEAN` sebagai
  `0`/`1`, dan validator respons memeriksa tipe JSON-nya.
- Sandi: 8–72 byte UTF-8, tidak dipangkas, NUL → `invalid_format`. Saat masuk, sandi bermuatan
  NUL atau lebih dari 72 byte langsung 401.
- Pemangkasan teks hanya membuang spasi, tab, CR, dan LF (bukan NBSP); panjang dihitung dalam
  code point. Jangan memakai `TrimStrings`/`ConvertEmptyStringsToNull` Laravel atau
  transformasi otomatis lain sebelum validasi. Field pilihan tetap (`role`, `type`, `status`,
  `method`, `vehicleType`) tidak dipangkas.
- Rute tanpa badan mengabaikan badan apa pun, termasuk JSON rusak (mis. `POST
  /api/staff/logout`, `…/confirm`, `…/tracking-link`, pembatalan booking publik).
- Pola regex dicocokkan terhadap seluruh string. `preg_match` PHP dengan `$` menerima baris
  baru di akhir (`"S-0001\n"`); pakai `\z` atau pengubah `D`.
- Titik koma di query adalah data biasa: `limit=1;page=2` → 422 `fields.limit:
  invalid_format`.
- Pesan WhatsApp dikirim **sesudah** commit; gagal kirim tidak menggagalkan transaksi. Kirim
  ulang yang gagal → 503. Penyedia dianggap menerima hanya bila HTTP 2xx **dan** `"status":
  true`. `failure_reason` disamarkan dari `WA_TOKEN` lalu dipotong 255 code point.

Yang khusus produk bengkel:

- **Tiga peran.** Mekanik hanya melihat SPK yang `mechanic`-nya dia sendiri (daftar
  tersaring; rincian, `PATCH`, dan `status` SPK lain → 403 sesudah 404), hanya boleh mengirim
  `diagnosis` di `PATCH`, dan hanya boleh menuju `IN_PROGRESS`, `WAITING_PARTS`, atau `DONE`.
- **`costPrice` tidak ada sama sekali** (bukan `null`, bukan 0) di sparepart untuk kasir dan
  mekanik, dan tidak pernah ada di item SPK, halaman publik, nota, maupun pesan WhatsApp.
- **Token lacak disimpan apa adanya** (`work_orders.tracking_token`, keputusan 0a-1); token
  booking hanya hash-nya dan hanya dikirim sekali.
- **Nomor HP dan plat** dinormalisasi persis seperti skema `NomorHpMasukan` dan `PlatMasukan`
  (format dinilai sebelum panjang). Respons publik selalu memakai nomor tersamar
  `6281****7890`.
- **Stok sparepart berkurang saat item ditambahkan** (kartu `USED`), kembali saat item dihapus
  atau SPK dibatalkan (`RETURNED`); jumlah semua `quantity` kartu stok selalu sama dengan
  `stock`. Pesan `insufficient_stock` berformat baku dengan angka polos.
- **Status SPK bukan maju satu langkah**: `IN_PROGRESS` ⇄ `WAITING_PARTS`, `DONE` butuh minimal
  satu item, `PICKED_UP` butuh lunas (SPK bertotal 0 dianggap lunas).
- **Rekap harian** memakai batas tanggal WIB `[D−1 17:00, D 17:00)` UTC; nilai, modal, laba,
  dan terlaris dari SPK yang baris linimasa `DONE`-nya jatuh di tanggal itu.
- **Booking publik tidak mengirim WhatsApp**; pesan pertama dikirim saat staf mengonfirmasi
  atau menolak, dan tidak memuat teks ketikan pemesan.
- **Urutan kunci** `outlet` → booking → pelanggan → kendaraan → `counters` → SPK → sparepart
  (urut `partId` naik). Deadlock (1213) dan batas tunggu kunci (1205) diulang paling banyak 3
  kali; errno 1062 dipetakan ke 409 yang sesuai.
