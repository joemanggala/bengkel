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

> Status (versi 0.1.0): rancangan disetujui; **fondasi selesai** (Bagian 0a): kontrak API
> (`spec/`, 52 operasi, lolos lint), templat WhatsApp, migration (`db/`), dan docker-compose.
> Alat uji (Bagian 0b), backend Laravel, dan web menyusul.

README ini untuk pengembang repo. ZIP paket jualan nanti memakai README sendiri dari
`alat/kemas-varian/templat/`, dan tidak membawa `docs/rancangan.md`, `docs/eksekusi/`,
`tests/kontrak/`, maupun `alat/`.

## Dokumen

- [`docs/rancangan.md`](docs/rancangan.md): peran, alur, aturan bisnis, data, keputusan, dan
  pembagian bagian eksekusi.
- [`docs/menjalankan.md`](docs/menjalankan.md): menyalakan MySQL, migration, pemilik pertama,
  dan lint kontrak.
- [`spec/openapi.yaml`](spec/openapi.yaml): kontrak API, satu-satunya sumber kebenaran untuk
  semua backend.
- [`spec/whatsapp.md`](spec/whatsapp.md): pengiriman WhatsApp dan templat pesan.
- [`docs/eksekusi/`](docs/eksekusi/): aturan bersama dan tugas per bagian.

## Susunan

```
spec/            kontrak API (OpenAPI 3.1) dan templat WhatsApp
db/              migration bersama (golang-migrate) dan skrip pembuat database
docs/            rancangan, panduan menjalankan, rencana per bagian (docs/eksekusi)
```

Folder `tests/`, `backend-laravel/`, `web/`, dan `alat/` dibuat bagian berikutnya.

## Mulai cepat

```sh
docker compose up -d mysql                       # MySQL di port 3350
docker compose run --rm migrate-dev up           # 16 tabel di database "bengkel"
npx --yes @redocly/cli@1.34.20 lint spec/openapi.yaml --config spec/redocly.yaml
```

Lisensi: lihat berkas [`LICENSE`](LICENSE).
