# Aplikasi Bengkel

Website publik dan aplikasi pengelolaan bengkel motor dan mobil untuk satu outlet, dari booking
online sampai kendaraan diambil: booking dari website yang dikonfirmasi staf, SPK dengan status
dan mekanik yang ditugaskan, item jasa dan sparepart dengan stok yang berkurang otomatis,
pembayaran yang boleh dicicil, pesan WhatsApp dan halaman lacak servis untuk pelanggan, riwayat
servis per kendaraan, dan rekap harian beserta laba kotor.

| Bagian | Isi |
|---|---|
| backend | satu varian: Laravel (Go dan NestJS menyusul), dengan kontrak API yang sama |
| web | Next.js: website publik bengkel (booking dan lacak servis) dan panel untuk pemilik, kasir, dan mekanik |
| pihak ketiga | penyedia WhatsApp berbentuk Fonnte (dengan WhatsApp palsu untuk dev dan tes) |

> Status (versi 0.1.0): rancangan, fondasi (kontrak API `spec/` dengan 52 operasi yang lolos
> lint, templat WhatsApp, migration `db/`, docker-compose), WhatsApp palsu dan tes kontrak,
> **backend Laravel** (lolos seluruh tes kontrak), **web**, tes E2E Playwright, pengemas paket, dan
> empat panduan Word **selesai**. Backend Go dan NestJS menyusul.

README ini untuk pengembang repo. ZIP paket jualan nanti memakai README sendiri dari
`alat/kemas-varian/templat/`, dan tidak membawa `docs/rancangan.md`, `docs/eksekusi/`,
`tests/kontrak/`, maupun `alat/`.

## Dokumen

- [`docs/rancangan.md`](docs/rancangan.md): peran, alur, aturan bisnis, data, keputusan, dan
  pembagian bagian eksekusi.
- [`docs/menjalankan.md`](docs/menjalankan.md): menyalakan MySQL, migration, pemilik pertama,
  WhatsApp palsu, backend Laravel, dan web, serta lint dan tes kontrak.
- [`backend-laravel/README.md`](backend-laravel/README.md) dan [`web/README.md`](web/README.md):
  rincian backend dan web, termasuk produksi.
- [`spec/openapi.yaml`](spec/openapi.yaml): kontrak API, satu-satunya sumber kebenaran untuk
  semua backend.
- [`spec/whatsapp.md`](spec/whatsapp.md): pengiriman WhatsApp dan templat pesan.
- [`docs/eksekusi/`](docs/eksekusi/): aturan bersama dan tugas per bagian.

## Susunan

```
spec/              kontrak API (OpenAPI 3.1) dan templat WhatsApp
db/                migration bersama (golang-migrate) dan skrip pembuat database
backend-laravel/   backend Laravel (tanpa ORM), lolos seluruh tes kontrak
web/               Next.js: website publik dan panel staf, lewat BFF
tests/kontrak/     tes kontrak (Vitest) untuk semua backend
tests/wa-palsu/    WhatsApp palsu untuk dev dan tes
tests/e2e/         tes E2E Playwright terhadap backend, web, dan WhatsApp palsu
alat/kemas-varian/ pengemas ZIP paket jualan per varian
alat/panduan-word/ pembuat empat panduan Word di docs/panduan
docs/              rancangan, panduan menjalankan, panduan Word, rencana per bagian (docs/eksekusi)
```

Folder `backend-go/`, `backend-nestjs/`, dan `mobile/` menyusul.

## Mulai cepat

```sh
docker compose up -d mysql                       # MySQL di port 3350
docker compose run --rm migrate-dev up           # 16 tabel di database "bengkel"
(cd tests/wa-palsu && npm ci && npm start)       # WhatsApp palsu, http://localhost:8890
(cd backend-laravel && composer install && cp .env.example .env && php artisan bengkel:serve)   # :8802
(cd web && npm ci && cp .env.example .env.local && npm run dev)                               # :3800
npx --yes @redocly/cli@1.34.20 lint spec/openapi.yaml --config spec/redocly.yaml
```

Tiap layanan di terminal sendiri. Isi `SETUP_TOKEN` di `backend-laravel/.env` sebelum membuat
pemilik pertama lewat <http://localhost:3800/admin>; langkah lengkapnya di `docs/menjalankan.md`.

Lisensi: lihat berkas [`LICENSE`](LICENSE).
