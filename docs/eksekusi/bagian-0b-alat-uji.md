# Bagian 0b: Alat uji

Baca `docs/rancangan.md`, `docs/eksekusi/aturan-bersama.md`, `spec/openapi.yaml` (terutama
deskripsi API di bagian atas), `spec/whatsapp.md`, dan `docs/menjalankan.md`. Bagian ini membuat
semua yang dibutuhkan backend pertama: tes kontrak yang lengkap (masih merah karena belum ada
backend), WhatsApp palsu, dan penyempurnaan `docs/menjalankan.md`. **Tidak ada kode backend atau
web di bagian ini.**

## Acuan (hanya dibaca)

`D:\KODE_PRODUK\kafe-resto\tests\kontrak` (Vitest + TypeScript: `src/klien.ts`, `src/galat.ts`,
`src/data.ts`, `src/db.ts`, `src/format.ts`, `src/wa.ts`, `src/banding.ts`, `src/env.ts`,
`src/spec.ts`, `src/cek-harness.ts`, `global-setup`, dan berkas di `tes/`) dan
`tests\wa-palsu`. Pakai versi dependensi yang sama (lihat `tests/kontrak/package.json` kafe-resto,
sudah berisi Redocly). Ganti: nama database (`bengkel_uji…`), port (lihat `aturan-bersama.md`),
jumlah tabel, nomor `S-` dan `B-`, buang menu, meja, QR, foto, dan pajak; tambah pelanggan,
kendaraan, plat, booking publik, SPK, item, mekanik, dan sparepart.

## Hasil yang diminta

| Berkas | Isi |
|---|---|
| `tests/wa-palsu/` | tiruan Fonnte sesuai `spec/whatsapp.md`, beserta tesnya sendiri. Port dev 8890; instans uji 8891/8892/8893 |
| `tests/kontrak/src/` | harness: klien HTTP bertipe yang memvalidasi setiap respons terhadap spec yang dibundel (objek tertutup), akses database uji (pengosongan, fixtur, penetapan waktu), pembuat data lewat API, format pesan WA yang ditulis ulang dari spec, penunggu backend, pemeriksa lingkungan, `cek-harness` |
| `tests/kontrak/tes/` | tes untuk setiap operasi dan aturan (daftar di bawah) |
| `tests/kontrak/fixtur/` | hash bcrypt fixtur lintas backend |
| `tests/kontrak/.env.example`, `README` singkat | cara menjalankan ke backend mana pun |
| `docs/menjalankan.md` | tambahkan bagian WhatsApp palsu, tes kontrak, dan hal kontrak yang mudah terlewat |

## Berkas tes yang diharapkan

`kesehatan`, `setup`, `staf-auth`, `kelola-staf` (tiga peran, peran tak dikenal 422, pemilik
terakhir), `outlet`, `publik-jasa`, `jasa`, `pelanggan` (normalisasi HP dalam semua bentuk,
`phone_taken`, cari nama/HP, paginasi), `kendaraan` (normalisasi plat dan bentuk tampilan sesuai
contoh spec, `plate_taken`, cari plat dalam bentuk apa pun, riwayat servis), `sparepart`
(kunci `costPrice` tidak ada untuk kasir dan mekanik, filter `lowStock`, SKU unik, stok tidak
bisa diubah lewat PATCH), `stok` (masuk, keluar dengan catatan, hitung ulang, kartu stok dengan
`stockAfter`, tidak pernah negatif), `booking-publik` (buat, token sekali, validasi tanggal WIB,
jasa harus aktif dan publik, `too_many_pending_bookings`, lihat, batal hanya `PENDING`, 404 token
tak dikenal), `booking-staf` (daftar dan filter, konfirmasi, tolak dengan alasan, transisi tak
sah), `konversi-booking` (pelanggan dan kendaraan dipakai ulang atau dibuat,
`plate_owned_by_other_customer`, jasa jadi item pertama, dari `PENDING` dan `CONFIRMED`),
`spk-baru` (validasi, nomor, `trackingToken` sekali, mekanik nonaktif ditolak), `daftar-spk`
(filter status, mekanik, tanggal WIB, cari nomor/plat/nama/HP, mekanik hanya melihat miliknya),
`ubah-spk` (kasir vs mekanik), `status-spk` (setiap transisi sah dan tak sah, mekanik hanya ke
tiga status dan hanya SPK miliknya, `not_paid_off`, linimasa), `item-spk` (stok berkurang dan
kembali, dua item part yang sama, `insufficient_stock`, `work_order_locked`, batas 50 item dan
jumlah 1–99, harga jasa boleh diisi, harga part dari katalog, jasa/part nonaktif ditolak,
`costPrice` item tidak pernah muncul), `batal-spk` (alasan wajib, `has_payments`, stok kembali),
`pembayaran` (cicilan, status bayar turunan, melebihi sisa, SPK batal/diambil), `kirim-wa`
(kirim ulang tiap jenis, isi byte demi byte sesuai `spec/whatsapp.md`, WA gangguan), `wa-otomatis`
(booking dikonfirmasi, ditolak, SPK dibuat, SPK selesai; tidak ada WA dari form publik; gagal
kirim tidak menggagalkan transaksi), `publik-lacak` (respons publik SPK, HP tersamar, tanpa data
staf dan harga beli, buat ulang tautan mematikan token lama), `matriks-peran` (setiap sel tabel
izin di deskripsi API), `rekap` (setiap angka, SPK batal tidak dihitung, laba kotor, catatan
harga beli belum lengkap, batas tanggal WIB), `serentak` (nomor SPK dan booking tanpa celah, stok
terakhir dipakai dua kasir bersamaan, batas 3 booking menunggu, setup bersamaan), dan
`sandi-lintas-backend`.

## Konvensi tes

Sama persis dengan bagian "Konvensi tes" di `D:\KODE_PRODUK\kafe-resto\docs\eksekusi\bagian-0b-alat-uji.md`:
satu berkas per area (maksimal ±500 baris), database dikosongkan sebelum setiap berkas, data unik
per tes, setiap kalimat tegas di spec punya tes, **jangan menebak** (spec ambigu → catat, jangan
diuji), uji urutan pemeriksaan, `fields` persis, waktu ditetapkan lewat helper database, kasus
serentak lewat `Promise.all`, pesan WA dibandingkan huruf demi huruf dengan `src/format.ts`.

## Tanda selesai

- [ ] `tests/wa-palsu` hijau, typecheck bersih.
- [ ] `npm run cek-harness` hijau tanpa backend.
- [ ] `BASE_URL=http://localhost:8882 npm test` gagal dengan pesan jelas ("Backend tidak bisa
      dihubungi di …"), bukan karena harness rusak.
- [ ] Semua berkas tes terkumpul Vitest tanpa galat; `npm run typecheck` bersih.
- [ ] Setiap aturan di `spec/` dan `docs/rancangan.md` punya tes kontrak.
- [ ] Setiap berkas kode diawali dua baris header hak cipta (diperiksa otomatis), semuanya LF.

## Catatan untuk Bagian 1

Berbeda dengan produk lain, backend pertama di sini adalah **Laravel**, bukan Go. Tes kontrak
pertama kali dibuktikan oleh Laravel. Bila ada yang merah, kemungkinannya tiga: bug backend, bug
tes, atau spec ambigu. Jangan menyesuaikan tes agar hijau tanpa membaca spec; putuskan mana yang
benar, perbaiki yang salah, dan catat perubahannya di bagian "Catatan serah-terima" berkas ini.

## Laporan akhir

Jumlah tes per berkas, keputusan yang kamu ambil sendiri beserta alasannya, ketidakjelasan atau
kekeliruan di spec yang kamu temukan (jangan diperbaiki diam-diam: laporkan), dan pertanyaan
terbuka.
