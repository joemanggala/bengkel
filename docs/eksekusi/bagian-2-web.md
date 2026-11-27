# Bagian 2: Web Next.js (website publik dan panel staf)

Baca `docs/rancangan.md` (terutama "Keputusan pengguna" dan "Halaman web"),
`docs/eksekusi/aturan-bersama.md`, dan `spec/`. Acuan pola dan **desain**: `D:\KODE_PRODUK\kafe-resto\web`
(BFF, cookie `httpOnly`, panel admin, token warna di `src/app/globals.css` dengan tes kontras di
`src/tema`, halaman publik tanpa masuk, cetak 58 mm) dan `D:\KODE_PRODUK\laundry\web`. Keduanya
meniru admin KodeCoding (`D:\KODE_BELAJAR\frontend`): sidebar lipat, kolom No, baris per halaman,
pita judul halaman yang ramping. Next.js 15 App Router, React 19, Tailwind 4, Vitest, versi
dependensi sama dengan kafe-resto. `API_URL` hanya dibaca server; panggilan dari browser lewat
route handler `/bff/*`.

**Desain sama dengan produk KodeCoding**, keputusan pengguna 2026-11-27: tema terang yang tenang,
satu warna utama (biru tua, keputusan #16, lolos tes kontras), warna lain hanya untuk makna
status. Jangan membuat gaya baru.

Dua permukaan dalam satu aplikasi:

- **Publik, tanpa masuk** (mobile first, nyaman di 360 px): `/` halaman depan (data outlet dari
  `GET /api/outlet`, jasa dari `GET /api/public/services`, langkah booking dan FAQ dari satu berkas
  konten, dirender di server), `/booking` (form dengan validasi klien; setelah berhasil diarahkan
  ke halaman status, token disimpan di alamat halaman dan penyimpanan lokal browser yang dibungkus
  try/catch), `/booking/[bookingToken]` (status, alasan tolak, batal selagi menunggu),
  `/servis/[trackingToken]` (status, linimasa, kendaraan, rincian item, total, terbayar, sisa;
  memuat ulang berkala). Token tidak berlaku → pesan jelas, bukan layar kosong.
- **Staf, di bawah `/admin`:** setup, masuk, Papan servis, SPK baru, Rincian SPK, Booking,
  Pelanggan, dan untuk pemilik Jasa, Sparepart (kartu stok, stok masuk/keluar/hitung ulang, stok
  menipis), Staf, Outlet, Rekap. Menu mengikuti peran (`owner`/`cashier`/`mechanic`); mekanik
  hanya melihat Papan servis berisi SPK miliknya dan Rincian SPK dengan aksi ubah status dan
  diagnosis.

## Tahap A

- Proyek `web/` dengan tooling yang sama dengan kafe-resto (typecheck, lint, Prettier, Vitest).
- Token warna dan tes kontras, komponen dasar (tombol, input, tabel dengan kolom No dan baris per
  halaman, lencana status SPK dan booking, kartu, notifikasi), tata letak panel dengan menu sesuai
  peran, tata letak publik.
- Mekanisme sesi staf: cookie httpOnly, BFF yang menambahkan token, pengalihan ke `/admin/masuk`
  bila sesi habis, pembatasan menu dan halaman per peran. Rute `/bff` publik tidak membawa cookie.
- Kerangka `/admin/setup` dan `/admin/masuk` dengan validasi form klien.
- Gaya cetak nota 58 mm (`@media print`).
- Klien API dan tipe data di balik antarmuka sesuai spec.

## Tahap B

Semua halaman tersambung ke API sesuai spec. SPK baru: cari plat atau HP, pakai pelanggan dan
kendaraan yang ada atau tambahkan. Rincian SPK: majukan status sesuai transisi sah, tugaskan
mekanik, tambah/hapus item jasa dan part (stok terlihat, galat `insufficient_stock` jelas), bayar
dengan kembalian, batalkan dengan alasan, kirim WhatsApp dan status kirimnya, buat ulang tautan
lacak, cetak nota. Papan servis dan daftar booking memuat ulang berkala.

## Tanda selesai

- [ ] Alur **booking publik → konfirmasi → jadikan SPK → tambah item → Dikerjakan → Selesai →
      bayar sebagian lalu lunas → Diambil** berjalan melawan backend Laravel (`:8802`, database
      `bengkel`, WA palsu `:8890`), termasuk halaman lacak pelanggan.
- [ ] Mekanik dan kasir tidak bisa membuka halaman pemilik.
- [ ] Typecheck, lint, Vitest (termasuk tes kontras), dan `next build` hijau.
- [ ] Setiap berkas diawali dua baris header hak cipta; identitas netral ("Nama Bengkel").

## Laporan akhir

Halaman yang dibuat, hasil typecheck/lint/tes/build, alur yang dicoba melawan Laravel, keputusan
tampilan yang kamu ambil sendiri, dan pertanyaan terbuka.
