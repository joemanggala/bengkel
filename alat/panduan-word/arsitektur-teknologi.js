// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Panduan arsitektur dan teknologi untuk pembeli yang ingin memahami atau mengembangkan kodenya.
// Isinya disalin dari README backend, kode web (src/server/bff.ts, src/klien, src/constants), spec
// (openapi.yaml, whatsapp.md), migration db/, dan catatan rancangan produk; versi pustaka dari
// composer.json dan package.json. Periksa lagi bila salah satunya berubah.

const { p, h1, h2, h3, titik, langkah, kotak, info, kode, tabel, sampul, simpan } = require('./umum')

const bab = [
    [
        h1('1. Gambaran Sistem'),
        p('Aplikasi ini adalah website dan aplikasi pengelolaan bengkel motor dan mobil untuk satu outlet: booking dari website, SPK servis dengan status dan mekanik, kasir dan stok sparepart, pelanggan dan kendaraan beserta riwayat servisnya, pesan WhatsApp, dan rekap harian. Ia dibangun sebagai bagian-bagian yang bisa dikembangkan terpisah: **backend** (aturan bisnis dan API), **web** (website publik dan panel staf), dan **database MySQL**, dengan **kontrak API** di tengahnya.'),
        h2('1.1 Bagian-bagiannya'),
        ...tabel(['Bagian', 'Teknologi', 'Tugas'], [
            ['**Web**', 'Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4', 'Website publik (`/`, `/booking`, `/booking/[token]`, `/servis/[token]`) dan panel staf di `/admin`. Juga berperan sebagai BFF (lihat bab 6).'],
            ['**Backend**', 'Laravel 13 di PHP 8.4, Query Builder tanpa Eloquent', 'Semua aturan bisnis: hitungan uang, status SPK dan booking, stok, pembayaran, penomoran, hak akses tiga peran, pesan WhatsApp, dan rekap.'],
            ['**Database**', 'MySQL 8.4', 'Menyimpan data. Skema dibuat oleh migration SQL bersama di `db/migrations`, dan aturan penting juga dijaga `CHECK`, `UNIQUE`, dan `FOREIGN KEY`.'],
            ['**Penyedia WhatsApp**', 'API berbentuk Fonnte', 'Mengirim pesan booking, SPK, siap diambil, dan nota. Untuk pengembangan dipakai WhatsApp palsu di `tests/wa-palsu`.'],
            ['**Kontrak API**', 'OpenAPI 3.1 di `spec/`', 'Satu-satunya sumber kebenaran bentuk permintaan dan balasan, kode galat, urutan pemeriksaannya, dan templat pesan WhatsApp (`spec/whatsapp.md`).'],
        ], [2, 4, 6]),
        h2('1.2 Aliran permintaan'),
        ...tabel(['Dari', 'Ke', 'Lewat'], [
            ['Browser (staf dan pelanggan)', 'Web (Next.js)', 'HTTPS. Browser hanya berbicara ke web, tidak pernah ke backend.'],
            ['Web (server)', 'Backend', 'HTTP di dalam server: `/bff/staf/...` menambahkan token dari cookie, `/bff/public/...` tanpa cookie dan hanya ke `/api/public/*`. Halaman yang dirender server memanggil backend langsung.'],
            ['Backend', 'MySQL', 'SQL lewat Query Builder; transaksi dengan penguncian baris untuk operasi yang mengubah beberapa tabel.'],
            ['Backend', 'Penyedia WhatsApp', 'HTTP keluar sesudah transaksi tersimpan, dicatat di tabel `wa_messages`. Gagal kirim tidak membatalkan transaksi.'],
        ], [4, 3, 5]),
        h2('1.3 Alasan memakai BFF'),
        p('Web berperan sebagai **Backend-for-Frontend (BFF)**: server Next.js yang berdiri di antara browser dan backend. **Pertama**, token sesi staf disimpan di cookie `httpOnly` dan hanya dibaca server web, jadi tidak pernah terjangkau JavaScript di halaman. **Kedua**, backend tidak perlu mengatur CORS karena browser tidak memanggilnya. **Ketiga**, web hanya meneruskan daftar rute yang diizinkan: pintu publik hanya lima rute persis (daftar jasa, membuat booking, status booking, membatalkan booking, dan lacak servis), sehingga rute baru di backend tidak ikut terbuka tanpa disengaja. **Keempat**, halaman depan dirender di server, jadi terbaca mesin pencari.'),
    ],
    [
        h1('2. Prinsip Rancangan'),
        ...tabel(['Prinsip', 'Penerapannya'], [
            ['**Kontrak dulu**', 'Bentuk API ditulis dulu di `spec/` (OpenAPI). Backend dan web mengikutinya, dan web memeriksa balasan dengan skema yang mencerminkan kontrak itu. Mengubah API berarti mengubah kontrak lebih dulu. Kontrak yang sama dipakai varian backend lain, jadi web bisa berpindah backend cukup dengan mengganti `API_URL`.'],
            ['**Backend yang menentukan**', 'Total, sisa, status bayar, stok, dan perpindahan status dihitung dan diperiksa di backend. Web hanya menampilkan; kembalian tunai satu-satunya hitungan di layar.'],
            ['**Database ikut menjaga**', 'Aturan penting juga ditulis sebagai `CHECK` dan `UNIQUE`: total SPK = jasa + part, terbayar tidak melebihi total, SPK diambil harus lunas, stok tidak negatif, kendaraan SPK harus milik pelanggan SPK, dan seterusnya. Bila suatu saat kode lupa memvalidasi, database tetap menolak.'],
            ['**Salinan, bukan rujukan**', 'Nama, harga jual, dan harga beli jasa atau sparepart disalin ke item SPK saat ditambahkan. Mengubah katalog tidak mengubah SPK lama maupun labanya.'],
            ['**Tanpa ORM**', 'Query ditulis eksplisit dengan Query Builder `DB::table()`, sehingga setiap query bisa dibaca dan dipelajari langsung.'],
            ['**Bahasa domain Indonesia**', 'Nama modul, kelas domain, dan metode memakai istilah bengkel (`StatusSpk::bolehKe`, `BatasMekanik::bolehBuka`). Kode status, kode galat, dan field JSON tetap bahasa Inggris (camelCase) sesuai kontrak. Teks UI, pesan galat, dan WhatsApp memakai sapaan "kamu".'],
            ['**Identitas netral**', 'Nama, kontak, alamat, dan jam buka bengkel diambil dari profil outlet (bawaan "Nama Bengkel"), bukan ditulis di kode.'],
        ], [3, 9]),
        h2('2.1 Keputusan produk yang memengaruhi kode'),
        ...tabel(['Keputusan', 'Alasan'], [
            ['Tiga peran: pemilik, kasir, mekanik. Mekanik hanya melihat SPK miliknya dan hanya mengubah status (Dikerjakan, Menunggu part, Selesai) dan diagnosis', 'Uang dan stok hanya disentuh peran yang bertanggung jawab atas kas.'],
            ['Pelanggan tanpa akun dan tanpa OTP, memakai dua token publik: `bookingToken` (satu booking) dan `trackingToken` (satu SPK)', 'Booking dan lacak servis harus semudah membuka tautan.'],
            ['Booking dari website mulai **Menunggu** dan harus diterima staf; paling banyak 3 booking menunggu per nomor HP; tanggal datang hari ini sampai 30 hari', 'Form publik bisa diisi siapa saja. Penerimaan staf adalah pengaman utama, ditambah pembatasan laju di Nginx.'],
            ['Tidak ada WhatsApp otomatis dari form publik; pesan booking tidak memuat teks ketikan pemesan', 'Nomor di form publik bisa nomor orang lain, jadi kirim otomatis bisa dipakai untuk spam.'],
            ['Sparepart berkurang saat ditambahkan ke SPK, kembali saat item dihapus atau SPK dibatalkan', 'Stok di layar harus sama dengan isi rak sepanjang hari.'],
            ['Harga beli sparepart hanya untuk pemilik: `costPrice` tidak ada sama sekali di respons untuk kasir dan mekanik', 'Modal adalah rahasia usaha.'],
            ['Nomor SPK `S-0001` dan booking `B-0001` berurutan terus', 'Mudah dirujuk pelanggan dan tidak bentrok antarhari.'],
            ['Halaman lacak `/servis/{token}` juga nota online', 'Satu tautan WhatsApp untuk pelanggan, bukan dua.'],
            ['Langkah booking dan tanya jawab halaman depan di satu berkas konten web (`web/src/constants/konten.ts`)', 'Jarang berubah; pembeli mengedit satu berkas tanpa CMS.'],
            ['Daftar SPK dan halaman lacak memuat ulang berkala (polling), tanpa WebSocket', 'Sederhana dan cukup untuk satu bengkel.'],
        ], [6, 6]),
    ],
    [
        h1('3. Model Data'),
        p('Database berisi 16 tabel, ditambah `schema_migrations` pencatat versi migration. ID berupa UUID `CHAR(36)` yang dibuat aplikasi, waktu `DATETIME(3)` dalam UTC, tanggal datang booking `DATE` dalam WIB, dan uang `BIGINT` rupiah bulat.'),
        ...tabel(['Tabel', 'Isi'], [
            ['`staff`', 'Pemilik, kasir, mekanik: nama, email (unik), hash sandi bcrypt, peran, aktif.'],
            ['`staff_sessions`', 'Sesi masuk staf; hanya hash SHA-256 tokennya yang disimpan, beserta waktu kedaluwarsa.'],
            ['`login_attempts`', 'Hitungan percobaan masuk per email (hash), untuk kunci 15 menit sesudah 10 kali gagal.'],
            ['`outlet`', 'Satu baris profil bengkel: nama, tagline, alamat, nomor WhatsApp, jam buka, tautan peta, kaki nota.'],
            ['`customers`', 'Pelanggan: nama, nomor HP (unik, bentuk `628…`), alamat, catatan internal.'],
            ['`vehicles`', 'Kendaraan milik pelanggan: jenis (`MOTOR`/`CAR`), plat tampilan, kunci plat (unik, huruf besar tanpa spasi), merek, tipe, tahun, warna.'],
            ['`services`', 'Katalog jasa: nama (unik), deskripsi, harga, durasi, tampil di website, aktif, urutan.'],
            ['`parts`', 'Katalog sparepart: SKU (unik), nama, satuan, harga jual, harga beli, stok, stok minimum, aktif.'],
            ['`stock_movements`', 'Kartu stok: jenis (`IN`, `OUT`, `COUNT`, `USED`, `RETURNED`), jumlah bertanda, stok sesudahnya, catatan, SPK, staf.'],
            ['`counters`', 'Penghitung nomor SPK dan booking.'],
            ['`bookings`', 'Booking: nomor, salinan data pemesan dan kendaraan, jasa (salinan nama), tanggal datang, keluhan, status, alasan tolak, hash token booking, dan SPK hasil konversi.'],
            ['`work_orders`', 'SPK: nomor, pelanggan, kendaraan, mekanik, status, keluhan, diagnosis, odometer, perkiraan selesai, subtotal jasa dan part, total, terbayar, alasan batal, token lacak, pembuat.'],
            ['`work_order_items`', 'Item SPK: jenis (`SERVICE`/`PART`), salinan nama, harga jual, harga beli, jumlah, subtotal.'],
            ['`work_order_status_logs`', 'Linimasa: status lama dan baru, staf, catatan, waktu.'],
            ['`payments`', 'Pembayaran: jumlah, metode (`cash`, `transfer`, `qris`), pencatat, waktu.'],
            ['`wa_messages`', 'Pesan WhatsApp keluar: jenis, nomor tujuan, isi persis, status kirim, alasan gagal.'],
        ], [3, 9]),
        h2('3.1 Aturan yang dijaga database'),
        p('Selain `UNIQUE` (email staf, nomor HP pelanggan, kunci plat, nama jasa, SKU, nomor SPK dan booking), migration memasang `CHECK` dan `FOREIGN KEY` untuk aturan bisnis, misalnya: total SPK sama dengan subtotal jasa + part; terbayar tidak melebihi total; SPK berstatus diambil harus lunas; SPK batal tidak boleh punya pembayaran; stok sparepart tidak negatif dan tanda jumlah kartu stok sesuai jenisnya; hanya perpindahan status yang sah yang bisa masuk ke linimasa; kendaraan di SPK harus milik pelanggan SPK itu (foreign key gabungan); plat tampilan sama dengan kunci platnya tanpa spasi; dan booking berstatus jadi SPK menunjuk tepat satu SPK.'),
        h2('3.2 Token'),
        p('Token sesi staf dan token publik berupa 32 byte acak yang ditulis base64url tanpa padding (43 karakter). Token sesi dan token booking hanya disimpan hash SHA-256-nya. **Token lacak SPK disimpan apa adanya**, karena pesan "siap diambil", nota, dan kirim ulang yang dikirim jauh sesudah SPK dibuat harus bisa merangkai tautan `/servis/{token}`. Membuat ulang tautan lacak mengganti token itu, sehingga tautan lama mati.'),
    ],
    [
        h1('4. Aturan Bisnis Utama'),
        h2('4.1 Hitungan uang'),
        titik('**Subtotal item** = harga × jumlah (jumlah 1 sampai 99, paling banyak 50 item per SPK). Harga jasa boleh diganti saat ditambahkan; harga part selalu harga jual katalog.'),
        titik('**Total** = subtotal jasa + subtotal part. Belum ada diskon atau pajak.'),
        titik('**Status bayar** turunan dari terbayar dan total: `unpaid`, `partial`, atau `paid` (SPK bertotal 0 dianggap lunas).'),
        titik('**Laba kotor** di rekap = subtotal jasa + subtotal part − modal part (harga beli yang disalin ke item × jumlah); jasa bermodal 0.'),
        h2('4.2 Status SPK'),
        p('`QUEUED` (Antre) → `IN_PROGRESS` (Dikerjakan) ⇄ `WAITING_PARTS` (Menunggu part); `IN_PROGRESS` → `DONE` (Selesai) → `PICKED_UP` (Diambil); ditambah `CANCELLED` (Dibatalkan). Perpindahan lain ditolak 409 `status_transition_invalid`. `DONE` butuh minimal satu item (`work_order_empty`), `PICKED_UP` butuh lunas (`not_paid_off`). Pembatalan hanya dari tiga status awal, wajib alasan, dan hanya bila belum ada pembayaran (`has_payments`); semua part kembali ke stok. Item dan data SPK terkunci sejak `DONE` (`work_order_locked`), sehingga rekap hari yang lewat tidak berubah. Setiap perubahan dicatat di linimasa.'),
        h2('4.3 Status booking'),
        p('`PENDING` (Menunggu) → `CONFIRMED` (Dikonfirmasi) → `CONVERTED` (Jadi SPK), dan `PENDING` boleh langsung ke `CONVERTED`. `REJECTED` (Ditolak) oleh staf dari `PENDING` atau `CONFIRMED`, wajib alasan; `CANCELLED` (Dibatalkan) oleh pelanggan hanya dari `PENDING`. Konversi mencari pelanggan dari nomor HP dan kendaraan dari plat, membuat yang belum ada tanpa menimpa nama pelanggan lama, dan menolak plat milik pelanggan lain (`plate_owned_by_other_customer`).'),
        h2('4.4 Stok sparepart'),
        p('Kartu stok mencatat setiap perubahan beserta stok sesudahnya, sehingga jumlah semua baris kartu stok satu sparepart selalu sama dengan stoknya. Item part mengurangi stok saat ditambahkan (`USED`) dan mengembalikannya saat dihapus atau SPK dibatalkan (`RETURNED`). Stok kurang ditolak 409 `insufficient_stock` dengan pesan yang menyebut sisa stoknya. Stok masuk boleh membawa harga beli baru, yang menjadi harga beli sparepart (harga beli terakhir).'),
        h2('4.5 Penomoran dan permintaan serentak'),
        p('Nomor SPK dan booking dibuat dalam transaksi dengan penguncian baris tabel `counters`, sehingga dua kasir tidak pernah mendapat nomor yang sama. Baris sparepart juga dikunci (`SELECT … FOR UPDATE`) supaya dua kasir tidak memakai stok terakhir bersamaan, begitu pula batas tiga booking menunggu per nomor HP. Urutan penguncian sama di semua rute (outlet → booking → pelanggan → kendaraan → penghitung → SPK → sparepart urut ID), dan transaksi yang terkena deadlock diulang paling banyak tiga kali. Karena itu backend harus dijalankan di server yang melayani permintaan bersamaan (PHP-FPM) agar penguncian ini benar-benar bekerja.'),
        h2('4.6 Pesan WhatsApp'),
        p('Ada lima jenis pesan: booking dikonfirmasi, booking ditolak, SPK dibuat (dengan tautan lacak), siap diambil (saat `DONE`), dan nota (hanya bila dikirim kasir). Templatnya ditetapkan byte demi byte di `spec/whatsapp.md`. Pesan dikirim **sesudah** transaksi tersimpan, dicatat di `wa_messages` beserta hasilnya, dan kegagalan tidak membatalkan transaksi. Penyedia dianggap menerima hanya bila balasannya HTTP 2xx **dan** `"status": true`. Alasan gagal disamarkan dari token penyedia lalu dipotong 255 karakter. Kasir bisa mengirim ulang pesan SPK; pesan booking tidak punya rute kirim ulang.'),
        h2('4.7 Nomor HP, plat, dan waktu'),
        titik('Nomor HP diterima `08…`, `+628…`, atau `628…` (boleh spasi dan tanda hubung), disimpan `628…`, 10 sampai 15 digit. Respons publik memakai nomor tersamar, misalnya `6281****7890`.'),
        titik('Plat dinormalisasi: kunci huruf besar tanpa spasi (`B1234XYZ`) untuk pencarian dan keunikan, tampilan dirapikan (`B 1234 XYZ`).'),
        titik('Semua waktu disimpan UTC. WIB (UTC+7 tetap) hanya untuk teks pesan, filter tanggal, batas tanggal datang booking, dan rekap harian (batas tanggal WIB).'),
        h2('4.8 Rekap harian'),
        p('Rekap memakai tanggal WIB. Nilai SPK, modal, laba, terlaris, dan SPK per mekanik dihitung dari SPK yang ditandai `DONE` di tanggal itu; "SPK masuk" dari tanggal dibuat; uang diterima dari tanggal pembayaran. SPK batal tidak dihitung, dan sparepart yang harga belinya 0 memunculkan catatan "Harga beli belum lengkap".'),
    ],
    [
        h1('5. Backend Laravel'),
        p('Backend memakai Laravel 13.36 di PHP 8.4 dengan Query Builder `DB::table()` tanpa Eloquent, sesi Bearer di database, dan HTTP ke penyedia WhatsApp lewat Guzzle. Validasi JSON, normalisasi nomor HP dan plat, format rupiah dan waktu WIB, serta aturan status ditulis sendiri supaya setiap aturan kontrak bisa dibaca langsung dari kodenya.'),
        h2('5.1 Susunan folder'),
        kode(`backend-laravel/
  artisan                 perintah konsol: bengkel:serve, bengkel:periksa, bengkel:migrate
  public/index.php        pintu masuk HTTP
  bootstrap/app.php       middleware global, alias middleware, penangan galat
  config/                 pengaturan Laravel (database, log, dan lainnya)
  app/
    Providers/            AppServiceProvider, ModuleServiceProvider (mendaftarkan semua modul)
    Http/Middleware/      EnforceRouteShape, ReadJsonBody, AuthenticateStaff, RequireRole
    Console/Commands/     ServeCommand, PeriksaCommand, MigrateCommand
    Modules/              satu folder per domain bisnis
      Kesehatan/ Sesi/ Staf/ Outlet/ Pelanggan/ Jasa/ Sparepart/ Stok/
      Booking/ Servis/ WhatsApp/ Rekap/
    Support/              alat generik: Config, Migrasi, Http, Validation, Format,
                          Database, Security, Text, Time
  tests/
    Unit/                 kelas murni, tanpa Laravel dan database
    Feature/              pipa HTTP Laravel lengkap dengan repository tiruan
    Fakes/                jam, repository sesi, dan batas masuk tiruan`),
        p('Modul SPK ada di `app/Modules/Servis` (`ServisService.php`), dengan aturan murni di kelas tersendiri: `StatusSpk` (perpindahan status), `AturanSpk` (urutan pemeriksaan 403/409), `BatasMekanik` (mekanik hanya SPK miliknya), `StatusBayar`, dan `NomorSpk`. Modul Booking punya `StatusBooking`, `NomorBooking`, dan `TanggalDatang`.'),
        h2('5.2 Pola satu modul'),
        ...tabel(['Berkas', 'Tugas'], [
            ['`XxxServiceProvider.php`', 'Mengikat repository ke kontraknya dan mendaftarkan rute beserta middleware-nya.'],
            ['`XxxController.php`', 'Membaca path, query, dan badan, memanggil service, menulis balasan.'],
            ['`Requests/`', 'Aturan validasi badan yang cukup besar.'],
            ['`XxxService.php`', 'Aturan bisnis; tidak tahu soal HTTP, mengembalikan data atau melempar `ApiError`.'],
            ['`Contracts/XxxRepositoryInterface.php`', 'Kontrak akses data yang dipakai service.'],
            ['`XxxRepository.php`', 'Query `DB::table(...)`; tidak tahu soal aturan bisnis.'],
        ], [4, 8]),
        h2('5.3 Urutan pemeriksaan satu permintaan'),
        kode(`EnforceRouteShape   HEAD, OPTIONS, path tak rapi (//, akhiran /) -> 404 JSON
└─ router Laravel   rute tak dikenal atau metode salah -> 404 JSON
   └─ json          ReadJsonBody: > 1 MiB -> 413, bukan objek JSON / UTF-8 rusak -> 400
      └─ staff      AuthenticateStaff: token Bearer bukan sesi staf aktif -> 401
         └─ peran   RequireRole (mis. peran:owner,cashier): peran lain -> 403
            └─ controller -> service: 404 -> 403 kepemilikan SPK (mekanik) -> 422 -> 409`),
        p('Urutan middleware di rute sengaja sama dengan urutan pemeriksaan di kontrak: JSON rusak tanpa token dibalas 400, dan kasir yang mengirim JSON sah ke rute pemilik dibalas 403. Rute publik tidak memakai `staff`, jadi header `Authorization` diabaikan di sana.'),
        h2('5.4 Keputusan teknis'),
        titik('**Validasi JSON sendiri** (`Support/Validation/JsonObject`). Validator bawaan Laravel menerima `"15000"` sebagai integer dan `1` sebagai boolean, dan tidak membedakan `null` dari field yang tidak dikirim. Semua regex memakai pengubah `D`, karena tanpa itu `$` di PHP juga cocok sebelum baris baru di akhir teks.'),
        titik('**Middleware global bawaan diganti.** `TrimStrings` dan `ConvertEmptyStringsToNull` mengubah input (sandi dan token tidak boleh dipangkas), `HandleCors` menambah header CORS, dan router Laravel otomatis menjawab HEAD dan OPTIONS; kontrak menolak semua itu.'),
        titik('**Guard sesi sendiri** (`Modules/Sesi`): token opaque, database hanya menyimpan hash SHA-256-nya, sesi 30 hari yang bergeser. Peran dibaca dari database setiap permintaan, jadi staf yang dinonaktifkan langsung kehilangan akses.'),
        titik('**Sandi bcrypt cost 12.** Awalan `$2y$`, `$2a$`, dan `$2b$` sama-sama diterima, sehingga hash buatan varian backend lain tetap cocok.'),
        titik('**Jam aplikasi** (`Support/Time/Clock`) dalam UTC dengan milidetik; `NOW()` MySQL tidak dipakai.'),
        titik('**Server dev `bengkel:serve`**, bukan `php artisan serve`: membaca env `PORT` bersama, tidak membuang env dari shell, memeriksa env dan database lebih dulu (`bengkel:periksa`), dan mematikan tampilan galat PHP supaya tidak tercampur ke badan JSON. Di produksi dipakai Nginx + PHP-FPM.'),
        titik('**Migration tanpa Docker** (`bengkel:migrate`) meniru golang-migrate: tabel `schema_migrations`, tanda kotor, dan kunci `GET_LOCK`, jadi satu database boleh dimigrasi bergantian dengan runner Docker. Skema hanya berasal dari `db/migrations`; tidak ada migration Laravel.'),
        titik('**Log** ditulis ke stderr dan hanya mencatat pola rute, bukan path asli, supaya token booking dan token lacak tidak masuk log.'),
        h2('5.5 Konfigurasi'),
        ...tabel(['Env', 'Wajib', 'Isi'], [
            ['`PORT`', 'ya', 'Port HTTP, mis. 8802.'],
            ['`DATABASE_URL`', 'ya', '`mysql://user:sandi@host:port/database`.'],
            ['`WA_API_URL`', 'ya', 'Alamat kirim lengkap dengan path, mis. `https://api.fonnte.com/send`.'],
            ['`WA_TOKEN`', 'ya', 'Token penyedia WhatsApp, dikirim apa adanya di header `Authorization` tanpa `Bearer`.'],
            ['`PUBLIC_WEB_URL`', 'ya', 'Alamat website untuk tautan di pesan WhatsApp; garis miring di akhir dibuang.'],
            ['`SETUP_TOKEN`', 'tidak', 'Token pembuatan pemilik pertama, minimal 16 byte; kosong = pemasangan awal mati (403).'],
        ], [3, 1, 8]),
        p('Nama env sama di semua varian backend. Semua nilai dipangkas, dan kosong sesudah dipangkas berarti tidak diisi. Env khas Laravel (`APP_KEY`, `APP_ENV`, `DB_*`) tidak dipakai, dan `config:cache` tidak boleh dijalankan karena membuat Laravel berhenti membaca `.env`.'),
    ],
    [
        h1('6. Web'),
        h2('6.1 Susunan folder'),
        kode(`web/src/
  app/
    (publik)/             halaman depan, /booking, /booking/[bookingToken], /servis/[trackingToken]
    admin/                /admin/setup, /admin/masuk, dan (panel)/ untuk halaman staf:
                          papan, spk/baru, spk/[number], booking, pelanggan, jasa,
                          sparepart, staf, outlet, rekap
    bff/staf/[...jalur]   pintu BFF staf (cookie -> Authorization: Bearer)
    bff/public/[...jalur] pintu BFF publik (tanpa cookie, hanya /api/public/*)
    globals.css           token warna dan gaya dasar
  components/             komponen per fitur (papan, spk, booking, pelanggan, sparepart, ...)
                          dan ui/ (tombol, tabel, dialog, field, lencana, ...)
  klien/                  klien API: satu fungsi per operasi kontrak, di atas "pengangkut"
  server/                 kode khusus server: sesi, BFF, peran, server action masuk/keluar
  skema/                  skema Zod yang mencerminkan kontrak API dan aturan form
  constants/              menu panel, konten halaman depan (konten.ts), bawaan outlet
  utils/                  format rupiah dan waktu, nomor HP, plat, status, sesi
  tema/                   rumus kontras WCAG untuk tes token warna
  middleware.ts           penyaring pertama panel staf`),
        h2('6.2 Sesi dan BFF'),
        p('Masuk dan keluar lewat **server action**, bukan lewat BFF, karena balasan masuk berisi token sesi yang tidak boleh sampai ke JavaScript browser. Token disimpan di cookie `sesi_staf` yang `httpOnly` dan `SameSite=Lax`; atribut `Secure` mengikuti protokol permintaan atau env `COOKIE_SECURE`. Sesi backend bergeser 30 hari, dan cookie ditulis ulang dengan umur penuh setiap kali panel dibuka.'),
        p('Komponen di browser memanggil `/bff/staf/<rute>`, yang menambahkan `Authorization: Bearer` dari cookie lalu meneruskannya ke `/api/<rute>`; hanya kelompok rute staf yang dikenal yang diteruskan. Pintu `/bff/public/<rute>` tidak membaca cookie dan hanya meneruskan lima rute publik yang dicocokkan persis (metode + bentuk path), sehingga halaman publik tidak bisa menyentuh data staf walau pengunjungnya juga masuk sebagai staf di browser yang sama. Kedua pintu memeriksa asal permintaan (header `Origin` harus sama dengan host); pintu staf juga menolak permintaan tulis tanpa `Origin` kecuali browser menandainya `Sec-Fetch-Site: same-origin`. Badan yang tidak kosong wajib `Content-Type: application/json` (selain itu 415), dibatasi 1 MiB, dan balasan backend diteruskan apa adanya. Tautan lacak di nota cetak dan tombol Salin disusun dari env `PUBLIC_WEB_URL` web, yang sama dengan milik backend, supaya sama persis dengan tautan di pesan WhatsApp.'),
        h2('6.3 Hak akses per peran'),
        p('`middleware.ts` menolak halaman panel tanpa cookie sesi dan mengalihkan peran yang tidak berhak ke Papan servis dengan penjelasan; peran dibaca dari backend, tidak dari cookie, supaya perubahan peran langsung berlaku. Penjaga sebenarnya ada di server component (`wajibStaf`, `wajibKasir`, `wajibPemilik` di `src/server/sesi.ts`), dan di atas semuanya backend menolak peran yang tidak berhak dengan 403 di setiap rute. Daftar menu dan peran yang boleh membuka tiap halaman ada di `src/constants/menu.ts`.'),
        h2('6.4 Klien API dan skema'),
        p('`src/klien/buatKlien.ts` berisi satu fungsi per operasi kontrak: memilih rute, memanggil "pengangkut", dan memeriksa bentuk balasan sukses dengan skema Zod di `src/skema`. Pengangkut adalah satu-satunya bagian yang tahu cara permintaan sampai ke backend, sehingga kode yang sama dipakai di server Next.js (langsung ke backend dengan token), di browser lewat BFF staf, dan di browser lewat BFF publik. Tes cukup memakai pengangkut palsu. Form memakai React Hook Form dengan skema Zod yang aturannya sama dengan kontrak.'),
        h2('6.5 Tampilan'),
        p('Panel dan website memakai sistem tampilan yang sama: tema terang yang tenang, satu warna utama biru tua (`--color-utama` di `globals.css`), dan warna lain hanya untuk makna status. Semua warna adalah token di `globals.css`, dan tes kontras memastikan pasangan teks dan latar memenuhi WCAG AA. Mengganti warna utama cukup di satu token, lalu jalankan `npm test`. Panel memakai sidebar yang bisa diciutkan, kolom No dan pilihan baris per halaman di daftar, serta nota thermal 58 mm lewat `@media print`. Halaman `/admin/komponen` menampilkan galeri komponen untuk pengembang.'),
        h2('6.6 Lapisan keamanan web'),
        titik('Header keamanan di `next.config.ts`: larangan dibingkai situs lain (`X-Frame-Options: DENY`, `frame-ancestors \'none\'`), `nosniff`, `Referrer-Policy: same-origin` (alamat lacak memuat token rahasia), dan izin kamera, mikrofon, serta lokasi dimatikan. HSTS dipasang di Nginx.'),
        titik('Pengalihan sesudah masuk (`?ke=`) hanya ke halaman panel yang boleh dibuka peran itu, dan alamat pengalihan dibangun dari host yang dipakai browser, sehingga tautan masuk tidak bisa dipakai untuk mengalihkan ke situs luar.'),
        titik('Token booking hanya dikirim sekali oleh backend; web menyimpan tautannya di browser pemesan (daftar "Booking kamu") supaya pelanggan bisa membukanya lagi.'),
        titik('Halaman publik tidak pernah menampilkan harga beli, diagnosis, nama mekanik, catatan linimasa, atau nomor HP utuh, karena backend memang tidak mengirimkannya.'),
    ],
    [
        h1('7. Teknologi dan Versi'),
        p('Semua dependensi dipatok persis (tanpa `^` atau `~`) dan hanya memakai versi yang sudah berumur minimal dua minggu, supaya build pembeli sama dengan build penjual.'),
        ...tabel(['Bagian', 'Teknologi', 'Versi'], [
            ['Backend', 'PHP', '8.4'],
            ['', 'Laravel (`laravel/framework`)', '13.36.0'],
            ['', 'Guzzle (`guzzlehttp/guzzle`), HTTP ke penyedia WhatsApp', '8.2.0'],
            ['', 'PHPUnit, Laravel Pint (pengembangan)', '13.3.6, 1.32.1'],
            ['Web', 'Next.js, React', '15.5.28, 19.2.8'],
            ['', 'TypeScript, Tailwind CSS', '5.9.3, 4.3.3'],
            ['', 'Zod, React Hook Form, @hookform/resolvers', '4.6.7, 7.89.0, 5.9.1'],
            ['', 'Vitest, ESLint, Prettier (pengembangan)', '4.1.11, 9.39.5, 3.9.9'],
            ['Database', 'MySQL (image Docker)', '8.4.10'],
            ['', 'golang-migrate (runner migration Docker)', '4.20.1'],
            ['WhatsApp palsu', 'Node.js + TypeScript, hanya `node:http`', 'Node 20.17 ke atas'],
            ['Kontrak', 'OpenAPI', '3.1'],
        ], [2, 6, 3]),
    ],
    [
        h1('8. Pengujian'),
        ...tabel(['Bagian', 'Perintah', 'Isi'], [
            ['Backend', '`composer test`', 'PHPUnit tanpa database, beberapa detik. `tests/Unit` menguji kelas murni (validasi JSON, nomor HP, plat, waktu WIB, rupiah, aturan status SPK dan booking, batas mekanik, token, bcrypt, env); `tests/Feature` menyalakan pipa HTTP Laravel lengkap dengan repository tiruan untuk membuktikan urutan 413/400 → 401 → 403 → 422 dan matriks peran.'],
            ['', '`composer format-check`', 'Gaya kode dengan Pint (`composer format` untuk merapikan).'],
            ['', '`TEST_DATABASE_URL=… composer test`', 'Ikut menguji `bengkel:migrate` terhadap MySQL sungguhan. Pakai database **kosong** yang dibuat khusus: tes membuat semua tabel lalu menghapusnya, dan menolak berjalan bila database itu sudah berisi tabel.'],
            ['Web', '`npm test`', 'Vitest: logika form, klien API, BFF (rute yang boleh dan ditolak, asal permintaan), middleware dan peran, format dan normalisasi, kecocokan skema dengan contoh di kontrak, serta tes kontras token warna.'],
            ['', '`npm run typecheck`, `npm run lint`', 'TypeScript dan ESLint.'],
            ['WhatsApp palsu', '`npm test`', 'Tiruan API Fonnte, termasuk penolakan token dan bentuk badan.'],
        ], [2, 4, 6]),
        p('Perilaku backend juga sudah dibuktikan terhadap seluruh kontrak API oleh penjual sebelum paket dikemas, termasuk permintaan serentak di Nginx + PHP-FPM. Bila kamu mengubah backend, jalankan tes di atas dan coba alurnya di web (Panduan Menjalankan di Laptop, bab 3).'),
    ],
    [
        h1('9. Cara Mengembangkan'),
        h2('9.1 Contoh: menambah kolom "nomor rangka" pada kendaraan'),
        langkah([
            'Tambahkan migration baru di `db/migrations` (`000002_nomor_rangka.up.sql` dan `.down.sql`) yang menambah kolom `frame_number` ke `vehicles`, lalu jalankan `php artisan bengkel:migrate`.',
            'Ubah kontrak di `spec/` lebih dulu: field `frameNumber` di skema kendaraan dan di badan buat/ubah kendaraan.',
            'Backend: tambahkan aturan validasinya di modul `Pelanggan` (bagian `Requests/` atau service), kolomnya di repository, dan field-nya di balasan. Tambahkan unit test untuk aturannya.',
            'Web: tambahkan field di skema `src/skema/pelanggan.ts`, isian di `DialogKendaraan`, dan tampilannya di rincian pelanggan.',
            'Jalankan `composer test`, `npm test`, `npm run typecheck`, lalu coba di browser.',
        ]),
        h2('9.2 Contoh: mengubah teks halaman depan'),
        p('Langkah booking dan tanya jawab ada di `web/src/constants/konten.ts`. Ubah teksnya (tetap dengan sapaan "kamu", dan jangan menjanjikan hal yang tidak dikerjakan aplikasi, misalnya konfirmasi otomatis), lalu build ulang web. Nama, tagline, alamat, kontak, jam buka, dan tautan peta tidak ditulis di sana: semuanya dari menu **Outlet**.'),
        h2('9.3 Contoh: mengganti penyedia WhatsApp'),
        p('Penyedia dengan bentuk API selain Fonnte cukup disesuaikan di `app/Support/WhatsApp/WhatsAppClient.php`: cara mengirim dan cara membaca balasan sukses. Templat pesan dan pencatatan di `wa_messages` tidak perlu diubah.'),
        h2('9.4 Hal yang sebaiknya tidak diubah sembarangan'),
        titik('**Urutan penguncian baris** di transaksi (bab 4.5). Mengubah urutan bisa menimbulkan deadlock saat dua kasir bekerja bersamaan.'),
        titik('**Salinan harga di item SPK.** Menghitung ulang dari katalog akan mengubah nilai dan laba SPK lama.'),
        titik('**Penguncian SPK sejak Selesai.** Rekap hari yang lewat bergantung padanya.'),
        titik('**Daftar putih rute BFF publik** di `web/src/server/bff.ts`. Tambahkan rute publik baru dengan sengaja, satu per satu.'),
        titik('**Pengaturan PHP-FPM wajib** (`enable_post_data_reading = 0`, `display_errors = off`) dan larangan `config:cache`.'),
        titik('**Versi dependensi.** Periksa umur versi baru, lalu jalankan semua tes sebelum memperbarui.'),
        h2('9.5 Di luar cakupan versi ini'),
        p('Banyak cabang, diskon dan voucher, void atau refund pembayaran, pembayaran online, penjualan sparepart tanpa SPK, pembelian ke pemasok, kapasitas atau slot booking per jam, pengingat servis berkala otomatis, member dan poin, foto kendaraan dan sparepart, komisi mekanik, garansi per SPK, laporan bulanan, ekspor Excel, tampilan real-time (WebSocket), printer thermal lewat USB atau jaringan, dan aplikasi mobile staf.'),
    ],
]

module.exports = (keluar) =>
    simpan({
        keluar,
        judulDokumen: 'Panduan Arsitektur dan Teknologi',
        sampul: sampul({
            label: 'PANDUAN ARSITEKTUR',
            judul: 'Arsitektur dan Teknologi',
            subjudul: 'Susunan kode, pola rancangan, dan teknologi tiap bagian',
            ringkasan: [
                'Panduan ini menjelaskan bagaimana aplikasi bengkel disusun: bagian-bagiannya, model data, aturan bisnis utama, pola kode backend Laravel dan web Next.js, teknologi beserta versinya, pengujian, dan cara mengembangkannya dengan aman.',
                'Cocok untuk pembeli yang ingin mempelajari atau memodifikasi kode.',
            ],
        }),
        bab,
    })
