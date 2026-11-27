# Pembuat panduan Word

Membuat empat panduan pembeli di `docs/panduan/`. Alat ini tidak ikut dijual; hasilnya ikut paket
(`docs/panduan/` di daftar isi paket pengemas), dan nama berkasnya harus sama dengan daftar
panduan wajib di pengemas `alat/kemas-varian`.

| Skrip | Hasil |
|---|---|
| `panduan-pemakai.js` | `Panduan-Pemakai-Aplikasi-Bengkel.docx`: pemilik (outlet, jasa, sparepart dan stok, staf, rekap dan laba kotor), kasir (booking, konfirmasi dan tolak, jadikan SPK, SPK baru, item, mekanik, status, pembayaran dan nota, WhatsApp, tautan lacak, pelanggan), mekanik (papan servis, status, diagnosis), dan pelanggan (booking dan lacak servis), dengan 31 tangkapan layar dari aplikasi yang berjalan |
| `menjalankan-laptop.js` | `Panduan-Menjalankan-di-Laptop.docx`: MySQL dengan dan tanpa Docker, WhatsApp palsu, backend Laravel, web, mencoba dari HP |
| `upload-vps.js` | `Panduan-Upload-ke-VPS.docx`: Ubuntu, MySQL, PHP-FPM, Nginx + certbot dengan pembatasan laju untuk rute publik (`/api/public/*` lewat `/bff/public/*`), Next.js dengan systemd, Fonnte, `PUBLIC_WEB_URL`, cadangan, pemeliharaan |
| `arsitektur-teknologi.js` | `Panduan-Arsitektur-dan-Teknologi.docx`: susunan kode, model data, aturan bisnis, teknologi, pengujian, cara mengembangkan |
| `umum.js` | gaya, logo, dan potongan isi bersama (paragraf, langkah, tabel, kotak catatan, blok perintah, gambar); sama dengan produk lain |
| `buat-semua.js` | menjalankan semuanya, mengisi daftar isi lewat Word, lalu mengganti nama pengubah terakhir |
| `tangkap-layar.js` | mengisi bengkel contoh lewat API lalu memotret layar ke `gambar/` (lihat di bawah) |
| `gambar/` | tangkapan layar (PNG 256 warna) yang dipakai panduan pemakai |

Prasyarat: Node.js 20.17 ke atas, Microsoft Word (untuk mengisi daftar isi; tanpa Word pakai
`--tanpa-word` dan isi daftar isinya nanti lewat Update Field), dan brand kit toko di
`D:/KODE_BELAJAR/kodecoding-brand-kit` atau lokasi lain lewat env `KEMAS_BRAND_KIT` (untuk logo di
sampul dan kepala halaman).

```sh
cd alat/panduan-word
npm ci
npm run buat                        # empat panduan; atau: node buat-semua.js --tanpa-word
node buat-semua.js --hanya=3        # hanya panduan bernomor itu (1 sampai 4)
```

## Tangkapan layar

Gambar di `gambar/` dibuat dari aplikasi yang berjalan, bukan digambar tangan. `tangkap-layar.js`
tidak menyalakan apa pun sendiri: siapkan dulu database **kosong yang baru dimigrasi**, WhatsApp
palsu, backend, dan web build produksi. Contoh dengan port review (database `bengkel_review_panduan`,
backend 8865, WhatsApp palsu 8866, web 3865), dari folder project di Git Bash:

```sh
# Database kosong
docker compose exec -T mysql mysql -uroot -proot -e "CREATE DATABASE bengkel_review_panduan CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; GRANT ALL PRIVILEGES ON bengkel_review_panduan.* TO 'bengkel'@'%';"
(cd backend-laravel && DATABASE_URL=mysql://bengkel:bengkel@127.0.0.1:3350/bengkel_review_panduan php artisan bengkel:migrate)

# WhatsApp palsu dan backend (masing-masing di terminal sendiri)
(cd tests/wa-palsu && WA_PALSU_PORT=8866 npm start)
SETUP=$(openssl rand -hex 16)
(cd backend-laravel && PORT=8865 DATABASE_URL=mysql://bengkel:bengkel@127.0.0.1:3350/bengkel_review_panduan \
  WA_API_URL=http://localhost:8866/send WA_TOKEN=token-wa-uji-bengkel-bukan-kunci-asli \
  PUBLIC_WEB_URL=http://localhost:3865 SETUP_TOKEN=$SETUP php artisan bengkel:serve)

# Web: salinan sumber di .bangun/ (supaya .next tidak bentrok dengan dev server), build, start.
# node_modules ditautkan ke web/node_modules; salinan harus satu drive dengan web/.
mkdir -p alat/panduan-word/.bangun && cp -r web alat/panduan-word/.bangun/web   # tanpa node_modules dan .next
cd alat/panduan-word/.bangun/web && API_URL=http://127.0.0.1:8865 npx next build && \
  API_URL=http://127.0.0.1:8865 npx next start --port 3865 --hostname 127.0.0.1

# Memotret
cd alat/panduan-word
npx playwright install chromium     # sekali saja
API_URL=http://localhost:8865 WEB_URL=http://localhost:3865 SETUP_TOKEN=$SETUP npm run tangkap
```

Skrip memotret halaman pemasangan awal, lalu mengisi "Bengkel Sentosa Motor" lewat API: profil,
satu kasir dan dua mekanik, tujuh jasa (satu tidak tampil di website, satu nonaktif), enam
sparepart (satu habis, satu tanpa harga beli supaya rekap menampilkan catatannya) beserta stok
masuk dan keluar, lima pelanggan dengan kendaraannya, enam booking dari website (menunggu,
dikonfirmasi, ditolak, dibatalkan pelanggan, dan jadi SPK), dan enam SPK di semua status. Lalu
memotret layar pemilik, kasir, mekanik, dan pelanggan (ukuran HP). Dialog hanya dibuka dan diisi
untuk dipotret, tidak disimpan. Hasilnya menimpa `gambar/01` sampai `31`. Database itu tidak bisa
dipakai dua kali: hapus dan migrasi ulang sebelum memotret lagi.

Sesudah memotret, kecilkan semua gambar menjadi PNG 256 warna (tanpa dither) supaya panduan
pemakai tetap kecil. Dengan Python dan Pillow, dari folder `gambar/`:

```sh
python -c "import glob; from PIL import Image; [Image.open(f).convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True) for f in glob.glob('*.png')]"
```

Lalu jalankan `npm run buat` lagi. Panduan pemakai sekarang ±1 MB.

| Gambar | Isi |
|---|---|
| `01`–`02` | Pemasangan awal, Masuk |
| `03`–`10` | Pemilik: Outlet, Jasa, dialog Tambah jasa, Sparepart, Stok masuk, Kartu stok, Staf, Rekap |
| `11`–`25` | Kasir: Papan servis, Booking, rincian booking, tolak booking, jadikan SPK, SPK baru (cari dan form), rincian SPK, tambah item, ubah SPK (mekanik), pembayaran dengan kembalian, kartu WhatsApp, nota 58 mm, Pelanggan, rincian pelanggan |
| `26`–`27` | Mekanik: Papan servis, rincian SPK dengan diagnosis |
| `28`–`31` | Pelanggan di HP: halaman depan, form booking, status booking, lacak servis |

## Menguji panduan

- **Terbuka di Word tanpa perbaikan:** buka tiap `.docx` lewat COM Word dengan `OpenAndRepair`
  dimatikan (`Documents.Open(jalur, $false, $true, $false, '', '', $false, '', '', 0, 0, $false, $false, 0, $true)`);
  berkas yang rusak membuat `Open` gagal, bukan diperbaiki diam-diam.
- **Konfigurasi Nginx di panduan VPS** diekspor (`require("./upload-vps").nginx`). Tulis ke berkas
  lalu uji sintaksnya dengan `nginx -t` di kontainer, misalnya:

  ```sh
  docker run --rm -v $PWD/bengkel-batas.conf:/etc/nginx/conf.d/00-batas.conf:ro \
    -v $PWD/bengkel.conf:/etc/nginx/conf.d/bengkel.conf:ro nginx:1.27-alpine nginx -t
  ```

  Ini hanya memeriksa sintaks; perilaku pembatasan laju baru terbukti di VPS (lihat daftar periksa
  di panduan).

## Aturan isi panduan

- Sekarang hanya ada varian Laravel, jadi panduan menulis `backend-laravel` langsung. Bila varian Go
  atau NestJS menyusul, panduan yang sama ikut ke semua paket dan pemeriksa paket menolak teks yang
  menyebut folder backend varian lain: ubah perintahnya menjadi `cd backend-*` dan beri satu bagian
  per varian (lihat pola produk lain).
- Teks tidak boleh merujuk hal internal (folder tes kontrak dan E2E, `alat/`, catatan eksekusi,
  rancangan, runner migration database uji), produk lain penjual, penanda tahap pengerjaan
  ("Bagian" bernomor dengan huruf besar), atau jalur absolut mesin pengembang. Pemeriksa membaca
  teks tiap `.docx`.
- Ukuran tiap `.docx` paling besar 5 MB (batas pengemas).
- Sumber isi: README backend, `.env.example` backend dan web, `docker-compose.yml`,
  `db/tanpa-docker.sql`, `docs/menjalankan.md`, spec, dan label tombol di `web/src`. Bila salah
  satunya berubah, ubah skripnya lalu buat ulang. Jangan mengedit `.docx` langsung, karena
  perubahan itu hilang saat dibuat ulang.
- Langkah di panduan VPS disusun dari dokumentasi dan konfigurasi yang teruji di laptop, dan
  **belum dicoba di VPS sungguhan**. Coba ujung ke ujung di VPS baru sebelum produk dijual, dan
  perbaiki skripnya bila ada yang meleset.
