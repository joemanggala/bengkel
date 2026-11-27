# Web Aplikasi Bengkel (Next.js)

Satu aplikasi Next.js 15 (App Router, React 19, Tailwind 4, TypeScript ketat) dengan dua
permukaan:

- **Website publik, tanpa masuk** (mobile first 360 px): `/` (profil bengkel, jasa yang tampil di
  website, langkah booking, tanya jawab, dan form booking), `/booking/[bookingToken]` (status
  booking, dan pembatalan selagi menunggu), dan `/servis/[trackingToken]` (lacak servis sekaligus
  nota online).
- **Panel staf** di bawah `/admin`: `/admin/setup`, `/admin/masuk`, lalu **Papan servis**, rincian
  SPK, **SPK baru**, **Booking**, **Pelanggan**, dan khusus pemilik **Jasa**, **Sparepart**,
  **Staf**, **Outlet**, **Rekap**.

Browser tidak pernah berbicara langsung dengan backend dan tidak pernah memegang token staf: semua
panggilan lewat route handler `/bff/*` di server Next.js. Bentuk API ada di
[`../spec/openapi.yaml`](../spec/openapi.yaml) (satu-satunya sumber kebenaran); folder ini tidak
menebak apa pun di luar kontrak itu.

## Menjalankan

Prasyarat: Node.js 20.17 ke atas. Backend menyala lebih dulu; cara menjalankannya ada di README
folder backend dan di [`../docs/menjalankan.md`](../docs/menjalankan.md).

```sh
cd web
cp .env.example .env.local      # sesuaikan API_URL dengan backend yang kamu jalankan
npm ci
npm run dev                     # http://localhost:3800
```

| Env             | Isi                                                                                                                                                                                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_URL`       | alamat backend, tanpa `/api` di belakangnya. Hanya dibaca server (sengaja tanpa awalan `NEXT_PUBLIC_`). Saat pengembangan, bila kosong dipakai alamat dev bawaan (`ALAMAT_API_BAWAAN` di `src/server/api.ts`); di produksi wajib diisi (kosong = galat yang menyebut `API_URL`, bukan diam-diam memanggil localhost). |
| `COOKIE_SECURE` | opsional, `true` atau `false`; kosong = mengikuti protokol permintaan. Lihat "Cookie sesi".                                                                                                                                                                                                                           |

Pertama kali, buka `/admin`: bila backend belum punya akun staf, kamu dibawa ke `/admin/setup`
(butuh `SETUP_TOKEN` dari env backend). Sesudah akun pemilik dibuat, kamu dibawa ke halaman
**Outlet** untuk mengisi nama bengkel, alamat, nomor WhatsApp, dan jam buka yang tampil di
website. Akun kasir dan mekanik dibuat pemilik dari halaman **Staf**.

| Perintah                            | Fungsi                                                        |
| ----------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                       | server pengembangan, port 3800                                |
| `npm run build` lalu `npm start`    | build produksi, port 3800                                     |
| `npm run typecheck`                 | `tsc --noEmit`                                                |
| `npm run lint`                      | ESLint                                                        |
| `npm run prettier` / `prettier:fix` | cek / rapikan format                                          |
| `npm test`                          | Vitest (logika murni, BFF, sesi, middleware, skema, komponen) |

## Build dan produksi

```sh
npm ci
npm run build
API_URL=http://127.0.0.1:8802 npm start     # http://localhost:3800
```

`API_URL` dibaca saat server berjalan, bukan saat build, jadi satu hasil build bisa dipakai untuk
alamat backend mana pun. Di produksi, `next start` dijalankan sebagai layanan di belakang Nginx yang memegang HTTPS; langkah lengkapnya, termasuk contoh konfigurasi Nginx, ada di
Panduan Upload ke VPS di `docs/panduan`.

Hal yang wajib di produksi:

- **Nginx meneruskan `Host`, `X-Forwarded-Host`, dan `X-Forwarded-Proto`.** Pengalihan (sesi
  habis, belum masuk, peran yang membuka halaman di luar haknya) dibangun dari header itu, bukan
  dari `request.url`: di `next start`, host di `request.url` adalah milik server Next.js sendiri
  (`localhost:3800`), jadi tanpa header itu staf di belakang Nginx, atau tablet kasir yang membuka
  `http://192.168.x.x:3800`, dilempar ke `localhost`. Host yang bentuknya bukan nama host sah
  diabaikan (`src/server/alihkan.ts`).
- **Rate limit per alamat IP di Nginx** untuk halaman dan BFF booking publik, halaman lacak
  `/servis/*`, `/admin/masuk`, dan `/admin/setup`. Backend hanya melihat satu alamat IP (server
  web), jadi pagarnya harus di depan web.
- **Log akses Nginx** mencatat path, termasuk token booking dan token lacak di alamat halaman
  publik. Matikan atau samarkan untuk `/booking/`, `/servis/`, dan `/bff/public/`.

`next.config.ts` memasang header keamanan untuk semua halaman: `X-Frame-Options: DENY` dan
`Content-Security-Policy: frame-ancestors 'none'` (tidak boleh dibingkai situs lain),
`X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` (alamat lacak dan status booking
memuat token rahasia dan tidak boleh bocor lewat `Referer` ke situs luar), dan
`Permissions-Policy` yang mematikan kamera, mikrofon, dan lokasi. HSTS dipasang di Nginx sesudah
HTTPS terbukti stabil.

## Struktur folder

```
src/
  app/
    (publik)/, (publik)/booking/[bookingToken], (publik)/servis/[trackingToken]   website publik
    admin/masuk, admin/setup, admin/sesi-berakhir          tanpa kerangka panel
    admin/(panel)/papan, spk/baru, spk/[number], booking, booking/[bookingId],
      pelanggan, pelanggan/[customerId], jasa, sparepart, staf, outlet, rekap,
      komponen                                             halaman panel
    bff/staf/[...jalur]     BFF staf: cookie -> Authorization: Bearer
    bff/public/[...jalur]   BFF publik: tanpa cookie, hanya rute website publik
  middleware.ts             penyaring pertama panel (sesi dan peran)
  skema/                    skema zod = cermin spec/components/schemas (data, galat, meta)
  skema/form/               aturan form di browser (masuk, setup)
  klien/                    klien API bertipe di balik antarmuka KlienApi
  server/                   kode server: sesi, BFF, pengangkut ke backend, pengalihan, server action
  constants/menu.ts         menu panel sekaligus aturan akses per peran
  constants/konten.ts       isi halaman depan yang bukan dari database (langkah booking, tanya jawab)
  utils/                    format rupiah/waktu WIB, nomor HP, plat, aturan status SPK dan booking, peta galat
  components/ui/            bahan dasar: tombol, isian, tabel, lencana, dialog, toast, ...
  components/panel|auth|cetak/   kerangka panel, masuk dan setup, cetak nota 58 mm
  components/papan|spk|booking|pelanggan|jasa|sparepart|staf|outlet|rekap/   isi tiap halaman panel
  components/publik/        halaman website publik (booking, status booking, lacak servis)
  tema/kontras.ts           pemeriksa kontras WCAG untuk tes tema
```

Setiap berkas kode diawali dua baris hak cipta dan diberi komentar yang menerangkan _mengapa_.

## Website publik

Nama bengkel, tagline, alamat, nomor WhatsApp, jam buka, dan tautan peta diambil dari profil
outlet (halaman **Outlet** di panel), jadi tidak ada yang perlu diubah di kode. Langkah booking dan
tanya jawab ada di `src/constants/konten.ts`: isinya jarang berubah, jadi cukup diedit di berkas
itu lalu build ulang, tanpa CMS.

- **Daftar jasa** hanya memuat jasa yang ditandai tampil di website dan aktif.
- **Booking** dikirim lewat `/bff/public`. Booking baru selalu menunggu konfirmasi staf; pelanggan
  dibawa ke `/booking/[bookingToken]`, yang menampilkan statusnya dan tombol batal selagi
  menunggu. Backend memberikan token booking hanya sekali, jadi sebelum pindah halaman token
  juga disimpan di penyimpanan lokal browser; bagian **Booking kamu** di halaman depan membuka
  statusnya lagi tanpa perlu mencari tautannya.
- **Lacak servis** (`/servis/[trackingToken]`) adalah tautan yang dikirim lewat WhatsApp: status,
  linimasa, kendaraan, rincian jasa dan part, total, terbayar, dan sisa tagihan. Selama kendaraan
  masih di bengkel, halaman memuat ulang berkala. Tautan yang sudah dibuat ulang kasir menampilkan
  pesan tidak berlaku.

## Sesi staf dan BFF

BFF punya dua pintu yang sengaja dipisah: `/bff/staf` (butuh cookie sesi, untuk panel) dan
`/bff/public` (tanpa cookie, hanya rute website publik).

1. **Masuk** (`/admin/masuk`) dan **setup** (`/admin/setup`) memakai server action
   (`src/server/aksi/auth.ts`). Server memanggil `POST /api/staff/login` atau `POST /api/setup`,
   menyimpan token di cookie `sesi_staf` (httpOnly, SameSite=Lax, 30 hari), dan hanya mengirim
   alamat tujuan ke browser. Token tidak pernah sampai ke JavaScript halaman.
2. **Panggilan data** dari komponen klien lewat `/bff/staf/<rute>`; server menambahkan
   `Authorization: Bearer <token>` dari cookie lalu meneruskan ke `{API_URL}/api/<rute>`. Hanya
   kelompok rute staf yang dikenal yang diteruskan; `setup`, `staff/login`, `staff/logout`, dan
   rute publik ditolak di pintu ini. Penulisan dari situs lain ditolak (`Origin`), dan badan
   dibatasi 1 MiB, sama dengan batas backend.
3. **Website publik** memakai `/bff/public/<rute>`, yang **tidak membaca maupun meneruskan
   cookie** dan hanya mengenal lima rute (daftar putih metode + bentuk path: daftar jasa, kirim
   booking, status booking, batal booking, lacak servis). Pengunjung yang kebetulan juga masuk
   sebagai staf di browser yang sama tetap tidak membawa tokennya ke rute publik.
4. **Sesi habis**: backend membalas 401, BFF menghapus cookie, dan klien memindahkan halaman ke
   `/admin/masuk?sesi=berakhir&ke=<halaman asal>`. Di server component, 401 dialihkan ke
   `/admin/sesi-berakhir` (route handler penghapus cookie, karena server component tidak boleh
   mengubah cookie). `?ke=` hanya menerima halaman panel, jadi tidak bisa dipakai membuka situs
   lain.
5. **Keluar**: server action memanggil `POST /api/staff/logout`, menghapus cookie, lalu kembali ke
   `/admin/masuk`; cookie tetap hilang walau backend tidak terjangkau.

### Akses per peran

Satu daftar, `MENU_PANEL` di `src/constants/menu.ts`, dibaca oleh menu navigasi, middleware,
penjaga server, dan tujuan `?ke=`, jadi menu yang tampil dan halaman yang boleh dibuka tidak
mungkin berbeda:

| Halaman                              | Pemilik | Kasir                     | Mekanik                   |
| ------------------------------------ | ------- | ------------------------- | ------------------------- |
| Papan servis, rincian SPK            | ya      | ya                        | hanya SPK yang ditugaskan |
| SPK baru, Booking, Pelanggan         | ya      | ya                        | dialihkan ke Papan servis |
| Jasa, Sparepart, Staf, Outlet, Rekap | ya      | dialihkan ke Papan servis | dialihkan ke Papan servis |

Staf yang membuka halaman di luar haknya dibawa ke `/admin/papan?akses=ditolak`, yang menampilkan
penjelasan. Mekanik hanya mengubah status SPK miliknya (Dikerjakan, Menunggu part, Selesai) dan
mengisi diagnosis; item, pembayaran, dan pembatalan tetap di kasir. **Harga beli sparepart** hanya
terlihat pemilik: backend tidak mengirim `costPrice` ke kasir dan mekanik sama sekali, dan halaman
Sparepart serta Rekap, satu-satunya tempat angka itu tampil, khusus pemilik.

Tiga lapis penjaga, dari yang paling dangkal:

1. `middleware.ts`: tanpa cookie langsung ke halaman masuk. Untuk halaman yang tidak untuk semua
   peran, peran dibaca dari backend (`GET /api/staff/me`). Peran **tidak** disimpan di cookie,
   supaya perubahan peran oleh pemilik langsung berlaku dan cookie yang diubah pemakai tidak memberi
   akses. Bila backend tidak terjangkau, middleware membiarkan lewat dan lapisan berikutnya yang
   memutuskan.
2. Server component: `wajibStaf()`, `wajibKasir()`, dan `wajibPemilik()` (`src/server/sesi.ts`)
   dipanggil di layout dan di setiap halaman yang dibatasi. Inilah penjaga yang sebenarnya.
3. Backend menolak peran yang tidak berhak dengan 403 di setiap rute.

### Cookie sesi

Atribut `Secure` mengikuti protokol permintaan (`x-forwarded-proto`), bukan `NODE_ENV`: browser
menolak menyimpan cookie `Secure` yang diterima lewat `http://`, jadi build produksi yang dibuka
tablet kasir lewat jaringan lokal (`http://192.168.x.x:3800`) tidak akan pernah bisa masuk bila
dipaksa `Secure`. Di belakang HTTPS hasilnya `Secure`. Bila proxy HTTPS tidak meneruskan
`x-forwarded-proto`, isi `COOKIE_SECURE=true`; `COOKIE_SECURE=false` memaksa tanpa `Secure`.

Gejala yang paling sering: email dan sandi benar, tetapi halaman masuk kembali lagi dengan pesan
bahwa browser tidak menyimpan sesi. Itu berarti aplikasi dibuka lewat `http://` sementara cookie
dipaksa `Secure` (`COOKIE_SECURE=true`). Buka lewat alamat `https://`, atau kosongkan
`COOKIE_SECURE` untuk pemakaian di jaringan lokal.

Middleware menulis ulang cookie dengan umur penuh setiap kali halaman panel dibuka, karena sesi di
backend bergeser 30 hari setiap dipakai; staf yang membuka aplikasi setiap hari tidak dikeluarkan
pada hari ke-30.

## Klien API dan skema

`src/skema/*.ts` memuat skema zod untuk semua skema data di kontrak; tipe TypeScript diturunkan
darinya. `src/klien/` punya antarmuka `KlienApi` dengan satu metode per `operationId`, dan
`buatKlien(pengangkut)` yang mengisinya. Balasan sukses diperiksa terhadap skema; bila backend
menyimpang dari kontrak, hasilnya galat yang jelas, bukan data setengah rusak. "Pengangkut" adalah
satu-satunya bagian yang tahu cara permintaan sampai: langsung ke backend (server), atau lewat
`/bff/staf` dan `/bff/public` (browser). Tes memakai pengangkut palsu.

Peta teks Indonesia untuk kode galat dan kode aturan (`fields`) ada di `src/utils/galat.ts`. Tes
`src/skema/__tests__/kontrakSpec.test.ts` membandingkan daftar kode galat, pesan baku, enum, dan
label status langsung dengan `../spec/components/schemas/*.yaml`, jadi perubahan kontrak yang tidak
diikuti web langsung terlihat (dilewati bila folder `spec/` tidak ada di samping `web/`).

## Tampilan dan token warna

Semua bahan UI dibuat sendiri dengan Tailwind, tanpa pustaka UI. Semua warna ada di satu tempat,
blok `@theme` di `src/app/globals.css`:

| Token                                                            | Untuk                                                          |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `latar`, `permukaan`, `tinta`, `redup`                           | latar halaman, kartu, teks utama, teks keterangan              |
| `garis`, `garis-kuat`                                            | pembatas dekoratif; tepi kotak isian (kontras minimal 3:1)     |
| `utama`, `utama-tua`, `utama-pucat`                              | tombol utama, menu aktif, tautan (biru tua)                    |
| `fokus`                                                          | cincin fokus papan ketik (jingga, supaya beda dari menu aktif) |
| `bahaya*`, `peringatan*`, `berhasil*`                            | pesan galat, peringatan, dan berhasil                          |
| `st-*` (antre, dikerjakan, tunggu-part, selesai, diambil, batal) | lencana dan kolom status SPK                                   |
| `bk-*` (menunggu, dikonfirmasi, jadi-spk, ditolak, batal)        | lencana status booking                                         |

Token dipakai sebagai kelas Tailwind biasa (`bg-utama`, `text-redup`, `border-garis-kuat`). Untuk
memakai warna bengkel sendiri, cukup ganti nilai `--color-utama*`, lalu jalankan `npm test`: tes
kontras (`src/tema/__tests__/kontras.test.ts`) memeriksa setiap pasangan teks dan latar tetap
memenuhi WCAG AA (4,5:1 untuk teks, 3:1 untuk tepi isian dan cincin fokus). Huruf memakai font
sistem, jadi tidak ada unduhan font dan build tetap jalan tanpa internet.

Panel memakai laci di ponsel, rel ikon di tablet (768 px ke atas), dan sidebar di laptop (1024 px
ke atas); website publik dirancang
dari 360 px. `prefers-reduced-motion` dihormati.

Halaman `/admin/komponen` (tidak ada di menu) memuat semua komponen dengan data contoh dari
`src/constants/contoh.ts`, untuk melihat tampilan dan contoh pemakaian.

## Cetak nota 58 mm

Nota SPK dicetak dari rincian SPK lewat dialog cetak browser (komponen `NotaThermal`, gaya
`.nota-thermal` di `globals.css`). Isinya mengikuti templat nota WhatsApp, jadi pelanggan menerima
angka yang sama di kertas dan di ponsel; harga beli sparepart tidak pernah ada di nota. Nota
dirender dua kali (pratinjau di halaman dan portal `#area-cetak`); saat mencetak, semua anak
`<body>` selain `#area-cetak` disembunyikan. Lebar 48 mm (bidang cetak printer 58 mm), hitam pekat
tanpa abu-abu. Pilih kertas 58 mm di dialog cetak browser.

## Tes

`npm test` menjalankan Vitest: pemformat (rupiah, waktu WIB, nomor HP, plat), aturan status SPK
dan booking (tabel transisi ditulis ulang dengan tangan supaya perubahan yang tidak disengaja
langsung terlihat), peta galat, aturan akses per peran, sesi dan cookie, pengalihan di belakang
proxy, middleware, BFF (termasuk "pintu publik tidak membawa cookie"), klien API, skema terhadap
kontrak, kontras tema, dan komponen.
