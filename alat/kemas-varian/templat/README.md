# Source code Aplikasi Bengkel: {{nama}} + Next.js

Versi {{versi}}. Aplikasi bengkel motor dan mobil untuk satu outlet: website publik dengan daftar
jasa dan **booking online** tanpa akun, SPK (surat perintah kerja) servis dengan status dan
mekanik, kasir, stok sparepart, pelanggan dan kendaraan beserta riwayat servisnya, dan rekap
harian. Pelanggan booking dari HP, kasir mengonfirmasi atau menolak, lalu menjadikannya SPK.
Mekanik hanya melihat SPK yang ditugaskan kepadanya dan mengubah statusnya (Dikerjakan, Menunggu
part, Selesai). Sparepart yang ditambahkan ke SPK langsung mengurangi stok dan kembali bila item
dihapus atau SPK dibatalkan. Pembayaran boleh dicicil; kendaraan baru bisa diserahkan setelah
lunas. Pelanggan menerima pesan WhatsApp (booking dikonfirmasi atau ditolak, SPK dibuat, siap
diambil, nota) dan bisa memantau servis lewat tautan lacak. Harga beli sparepart dan laba kotor
hanya terlihat pemilik.

Baca `LICENSE` lebih dulu. Source code ini hanya untuk pembeli, dan tidak boleh dijual ulang atau
dibagikan.

Paket ini memuat backend {{nama}} dan web Next.js. Web hanya berbicara dengan backend lewat
kontrak API di `spec/`.

## Isi paket

| Folder | Isi |
|---|---|
| `{{folder}}/` | backend {{nama}}; README-nya menjelaskan arsitektur, alur satu permintaan, dan cara memasang di server |
| `web/` | web Next.js: website publik (jasa, booking, status booking, lacak servis) dan panel staf untuk pemilik, kasir, dan mekanik |
| `spec/` | kontrak API (OpenAPI) dan templat pesan WhatsApp |
| `db/` | migration SQL, `tanpa-docker.sql` (database dan user untuk MySQL yang kamu pasang sendiri), dan skrip pembuat database untuk Docker |
| `docs/menjalankan.md` | panduan lengkap MySQL, migration, pemilik pertama, WhatsApp palsu, dan WhatsApp sungguhan |
| `docs/panduan/` | empat panduan Word: pemakai (pemilik, kasir, mekanik, pelanggan), menjalankan di laptop, upload ke VPS, serta arsitektur dan teknologi |
| `tests/wa-palsu/` | WhatsApp palsu: menangkap semua pesan supaya bisa mencoba di laptop tanpa akun WhatsApp |
| `docker-compose.yml` | MySQL 8.4 dan runner migration, hanya bila kamu memilih jalur Docker |
| `VERSION` | versi paket ini |

## Mencoba di laptop

Prasyarat: MySQL 8.0.16 ke atas (atau Docker Desktop, lihat langkah 1), Node.js 20.17 ke atas{{prasyarat}}.
Setiap blok di bawah dijalankan di terminal sendiri, mulai dari folder paket ini.

| Layanan | Alamat |
|---|---|
| MySQL | `localhost:3306` bila dipasang sendiri, `localhost:{{portMysql}}` bila lewat Docker |
| Backend {{nama}} | http://localhost:{{port}} |
| Web | http://localhost:{{portWeb}} |
| WhatsApp palsu | http://localhost:{{portWa}} |

**1. Database, cukup sekali.** Pilih salah satu cara.

**Cara A, tanpa Docker (disarankan di Windows).** Pasang MySQL Community Server 8.4 LTS
(atau 8.0.16 ke atas) seperti aplikasi biasa dan catat sandi root yang kamu buat saat memasang.
**XAMPP tidak bisa dipakai**: isinya MariaDB, bukan MySQL 8. Lalu jalankan `db/tanpa-docker.sql`
sekali sebagai root untuk membuat database `bengkel` dan user `bengkel` / `bengkel`. Dari folder
paket ini (Git Bash), lalu ketik sandi root saat diminta:

```sh
"/c/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe" -u root -p -e "source db/tanpa-docker.sql"
```

Sesuaikan `8.4` dengan versi yang kamu pasang; bila `mysql` sudah ada di PATH, cukup
`mysql -u root -p -e "source db/tanpa-docker.sql"`. Bisa juga dibuka di MySQL Workbench atau
HeidiSQL lalu dijalankan semuanya. Bila mengetik `source` di dalam klien `mysql`, tulis lokasi
berkasnya dengan garis miring `/`, bukan `\` (mis. `source C:/bengkel/db/tanpa-docker.sql`), karena
`\t` di `\tanpa-docker.sql` terbaca sebagai tab. Tabelnya dibuat oleh backend di langkah 3.

**Cara B, dengan Docker.** Bila Docker Desktop sudah terpasang:

```sh
docker compose up -d mysql
docker compose run --rm migrate-dev up
```

Rincian kedua cara ada di `docs/menjalankan.md` bagian 1.

```sh
# 2. WhatsApp palsu: semua pesan (booking, SPK, siap diambil, nota) tampil di http://localhost:{{portWa}}
cd tests/wa-palsu
npm ci
npm start
```

```sh
# 3. Backend {{nama}} di http://localhost:{{port}}
{{siapkan}}
```

Buka `{{folder}}/.env` dengan editor teks (Notepad pun bisa). Isi `SETUP_TOKEN` dengan nilai acak
milikmu sendiri, minimal 16 karakter, mis. hasil `openssl rand -hex 16` (bisa dijalankan di Git
Bash). Di paket, nilainya sengaja kosong, dan nilai contoh dari dokumentasi ditolak saat backend
menyala. Token ini dipakai sekali untuk membuat akun pemilik pertama; tidak ada akun atau sandi
bawaan. Bila memakai Cara A, ganti juga port `{{portMysql}}` di `DATABASE_URL` menjadi port
MySQL-mu (umumnya 3306), lalu buat tabelnya:

```sh
{{migrasi}}
```

Perintah ini hanya untuk Cara A (pemakai Docker sudah menjalankan `migrate-dev up`). Jalankan
lagi setiap kali kamu memasang versi paket yang lebih baru; migration yang sudah jalan tidak
diulang. Setelah itu nyalakan backend:

```sh
{{mulai}}
```

```sh
# 4. Web di http://localhost:{{portWeb}}
cd web
npm ci
cp .env.example .env.local
npm run dev
```

Buka http://localhost:{{portWeb}}/admin. Selama belum ada akun, web membuka halaman pemasangan
awal: isi token pemasangan (sama persis dengan `SETUP_TOKEN`), nama, email, dan sandi pemilik.
Setelah itu ganti "Nama Bengkel" di menu **Outlet**, tambahkan **Jasa** (centang "Tampil di
website" untuk jasa yang boleh dipilih saat booking) dan **Sparepart** beserta stok awal dan harga
belinya, lalu buat akun **Kasir** dan **Mekanik** di menu **Staf**.

Mencoba booking: buka http://localhost:{{portWeb}} sebagai pelanggan, pilih jasa, lalu kirim
booking dengan nomor HP sembarang (mis. 0812-3456-7890). Sebagai kasir, buka menu **Booking**,
konfirmasi booking itu, lalu **Jadikan SPK** dan tugaskan mekanik. Pesan WhatsApp-nya, termasuk
tautan lacak servis, muncul di http://localhost:{{portWa}}. Dari HP di Wi-Fi yang sama, buka web
lewat IP laptop (mis. http://192.168.1.6:{{portWeb}}) dan isi `PUBLIC_WEB_URL` backend dan web
dengan alamat itu supaya tautan di pesan WhatsApp dan di nota juga terbuka di HP.

Panduan lengkap ada di `{{folder}}/README.md` dan `docs/menjalankan.md`.

## Memakai WhatsApp sungguhan (Fonnte)

Backend mengirim pesan lewat API berbentuk Fonnte. Untuk mengirim ke WhatsApp sungguhan:

1. Daftar di https://fonnte.com, sambungkan nomor WhatsApp bengkel dengan memindai kode QR dari
   dashboard Fonnte, lalu salin token perangkatnya.
2. Ubah dua baris di `{{folder}}/.env`, lalu nyalakan ulang backend:

   ```sh
   WA_API_URL=https://api.fonnte.com/send
   WA_TOKEN=<token perangkat dari dashboard Fonnte>
   ```

3. Buat SPK untuk nomor HP milikmu; pesan "SPK dibuat" seharusnya masuk. Bila tidak, lihat kartu
   WhatsApp di rincian SPK (status dan alasan gagal), baris terbaru tabel `wa_messages` (kolom
   `status` dan `failure_reason`), dan log pengiriman di dashboard Fonnte.

Token Fonnte adalah rahasia: tulis hanya di `.env` server, jangan di repo atau di
`.env.example`. Penyedia lain yang bentuk API-nya berbeda cukup disesuaikan di satu tempat, yaitu
klien WhatsApp di `{{folder}}/`.

## Wajib sebelum dipakai publik

- **`SETUP_TOKEN` dikosongkan** setelah akun pemilik pertama dibuat.
- **HTTPS dan reverse proxy (Nginx) di depan web**, beserta rate limit per alamat IP untuk
  halaman dan BFF booking publik (`/booking`, `/bff/public/*`), halaman lacak `/servis/*`,
  `/admin/masuk`, dan `/admin/setup`. Backend tidak dibuka ke internet; hanya web yang
  memanggilnya. Rinciannya di `docs/menjalankan.md` bagian "Syarat sebelum produksi" dan langkah
  lengkapnya di Panduan Upload ke VPS (`docs/panduan`).
- **Backend di Nginx + PHP-FPM**, bukan server bawaan PHP (`{{mulai}}` hanya untuk dev, karena
  melayani satu permintaan sekaligus). Pengaturan pool yang wajib ada di `{{folder}}/README.md`.
- **`PUBLIC_WEB_URL` backend dan web** diisi alamat web produksi yang sama (`https://…`), karena
  tautan lacak dan tautan booking di pesan WhatsApp, serta tautan lacak di nota cetak, dirangkai
  dari situ.
- **`API_URL` web** di server diisi alamat backend produksi, dan `COOKIE_SECURE=true` bila web
  dilayani lewat HTTPS (penjelasannya ada di `web/.env.example`).
- **Identitas:** nama bengkel, tagline, alamat, nomor WhatsApp, jam buka, tautan peta, dan teks
  kaki nota diatur pemilik dari menu Outlet di web, tanpa mengubah kode. Logo bawaan sengaja polos.
