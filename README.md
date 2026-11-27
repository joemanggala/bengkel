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

> Status: **rancangan** (`docs/rancangan.md`), menunggu tinjauan pengguna. Belum ada kode.

README ini untuk pengembang repo. ZIP paket jualan nanti memakai README sendiri dari
`alat/kemas-varian/templat/`, dan tidak membawa `docs/rancangan.md`, `docs/eksekusi/`,
`tests/kontrak/`, maupun `alat/`.

## Dokumen

- [`docs/rancangan.md`](docs/rancangan.md): peran, alur, aturan bisnis, data, dan keputusan.
- [`docs/eksekusi/`](docs/eksekusi/): aturan bersama dan tugas per bagian.

Lisensi: lihat berkas [`LICENSE`](LICENSE).
