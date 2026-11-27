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
`spk-baru` (validasi, nomor, `trackingToken` di rincian SPK sesuai keputusan 0a-1, mekanik nonaktif ditolak), `daftar-spk`
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

## Harness untuk penulis tes (sudah ada)

Dibuat pelaksana tahap harness 0b (2026-11-27). Hijau tanpa backend: `npm install`,
`npm run typecheck`, `npm run cek-harness`, `npm run lint-spec`; `tests/wa-palsu` 37 tes hijau
dan typecheck bersih; `BASE_URL=http://localhost:8882 npm test` berhenti di persiapan global
dengan "Backend tidak bisa dihubungi di http://localhost:8882 …". Contoh pola berkas tes:
`tes/kesehatan.test.ts` (102 tes) dan `tes/setup.test.ts` (44 tes, dua mode `SETUP_TOKEN`),
keduanya memakai `tes/pembantu-fondasi.ts`.

Penulis tes **tidak mengubah `src/`**. Bila ada pembantu yang kurang, taruh di
`tes/pembantu-<area>.ts` milikmu sendiri dan sebut di laporan. Semua fungsi pembuat data
**melempar** (bukan `expect`) bila backend membalas di luar yang diharapkan, supaya kegagalan
persiapan tidak tertukar dengan kegagalan aturan yang diuji. Balasan pembuat data = isi `data`
respons API (mis. `SpkDetail`, `SparepartPemilik`); tipenya `any` karena bentuknya sudah dijaga
validator respons.

### `src/klien.ts`: memanggil API

| Fungsi | Keterangan |
|---|---|
| `api.get/post/put/patch/delete(path, opsi?): Promise<Respons>` | opsi: `token` (jadi `Authorization: Bearer …`), `json`, `mentah` (teks apa adanya + `Content-Type: application/json`, untuk JSON rusak), `biner: {isi, jenis}`, `header`, `query` (objek; atau tulis query langsung di `path`, mis. `'/api/customers?limit=1;page=2'`). **Setiap respons divalidasi otomatis terhadap spec** (kode status tertulis, header wajib seperti `Retry-After`, media type, skema tertutup dengan Ajv); pelanggaran melempar `GalatKontrak`. `GET /api/parts` 200 juga dinilai per baris dengan skema milik peran peminta (`SparepartPemilik` untuk pemilik, `SparepartStaf` untuk kasir dan mekanik; peran dibaca dari database sebelum permintaan dikirim) |
| `Respons` | `{status, header: Headers, body (hasil JSON atau undefined), teks, metode, path, peran?}` |
| `mintaMentah(metode, path, header?)` | tanpa validasi spec (rute di luar spec) |
| `validasi(res)`, `ringkas(res)`, `GalatKontrak`, `USER_AGENT_UJI` | `ringkas` untuk pesan `expect` |

### `src/galat.ts`: memeriksa galat

| Fungsi | Keterangan |
|---|---|
| `harapGalat(res, status, code, fields?)` | kode HTTP, `code`, pesan baku dari `x-pesan-baku` spec (bila kode itu punya), dan `fields` **persis** (field lain tidak boleh ikut) |
| `harapStatus(res, status)` | kode HTTP dengan ringkasan badan bila gagal |
| `harapStokKurang(res, {name, unit, butuh, tersedia})` | 409 `insufficient_stock` dengan pesan berformat baku (`pesanStokKurang`) |

### `src/data.ts`: pembuat data lewat API

| Fungsi | Keterangan |
|---|---|
| `SANDI_UJI`, `Staf`, `SesiStaf {token, staff}` | sandi fixtur bcrypt |
| `emailUnik(awalan?)`, `namaUnik(awalan)`, `nomorUnik()` (628…, 13 digit), `platUnik(awalan = 'B')` (`"B 1234 XYZ"`, kunci 8 karakter), `skuUnik(awalan?)` | nilai yang tidak pernah sama di satu proses tes |
| `wajib(res, ...status): Respons` | melempar bila status lain |
| `masukStaf(email, password = SANDI_UJI): SesiStaf` | `POST /api/staff/login` |
| `buatStaf(role, {name?, email?}?)`, `buatPemilik()`, `buatKasir()`, `buatMekanik()` → `SesiStaf` | staf disisipkan ke database dengan hash fixtur lalu masuk lewat API |
| `aturOutlet(tokenPemilik, ubah?)` → `Outlet` | `PUT /api/outlet` dengan nilai sekarang sebagai dasar |
| `buatJasa(tokenPemilik, ubah?)` (bawaan nama unik, Rp35.000, publik, aktif), `buatJasaNonPublik(tokenPemilik, ubah?)` → `Jasa` | |
| `buatPart(tokenPemilik, ubah?)` → `SparepartPemilik` | bawaan SKU dan nama unik, `pcs`, jual Rp55.000, beli Rp40.000, `initialStock` 10, `minStock` 2 |
| `stokMasuk(tokenPemilik, partId, quantity, ubah?)`, `stokKeluar(tokenPemilik, partId, quantity, note = 'Rusak')`, `hitungStok(tokenPemilik, partId, countedStock, note = 'Opname')` → `SparepartPemilik` | |
| `buatPelanggan(token, ubah?)` ("Budi Santoso", nomor unik) → `Pelanggan`; `tambahKendaraan(token, customerId, ubah?)` (motor Honda Vario 125, plat unik) → `Kendaraan`; `buatPelangganDenganKendaraan(token, ubahPelanggan?, ubahKendaraan?)` → `{pelanggan, kendaraan}` | |
| `isianBooking(ubah?)` | badan form booking yang sah: tanggal datang hari ini WIB (jam database), nomor dan plat unik, tanpa jasa |
| `buatBookingPublik(ubah?)` → `{bookingToken, booking, bookingId}` | `booking` = `BookingPublik`; `bookingId` dibaca dari database (respons publik tidak memuat ID) |
| `bookingStaf(token, bookingId)`, `konfirmasiBooking(token, bookingId)`, `tolakBooking(token, bookingId, reason?)` → `Booking`; `jadikanSpk(token, bookingId, badan?)` → `{booking, workOrder}` | |
| `buatSpk(token, vehicleId, ubah?)` (keluhan "Servis rutin.") → `SpkDetail`; `detailSpk(token, nomor)` | |
| `tambahItem(token, nomor, badan)`, `tambahJasa(token, nomor, serviceId, quantity = 1, price?)`, `tambahPart(token, nomor, partId, quantity = 1)`, `hapusItem(token, nomor, itemId)` → `SpkDetail` | |
| `ubahStatus(token, nomor, status, note?)`, `majukanSampai(token, spk, tujuan)`, `batalkanSpk(token, nomor, reason?)` → `SpkDetail` | `majukanSampai` mengikuti jalur `QUEUED → IN_PROGRESS → (WAITING_PARTS) / DONE → PICKED_UP`; item dan pelunasan tidak diurus |
| `bayar(token, nomor, amount, method = 'cash')`, `lunasi(token, spk, method?)` → `SpkDetail` | |
| `kirimWa(token, nomor, type, phone?)` (hanya 200; untuk 503 pakai `api.post`), `buatUlangTautan(token, nomor)` → `SpkDetail`; `lacakPublik(trackingToken)` → `SpkPublik` | |
| `siapkanBengkel()` → `Bengkel` | `{pemilik, kasir, mekanik, gantiOli (publik, Rp35.000), cekKelistrikan (nonpublik, Rp50.000), oli ("Oli Mesin 10W-40 0,8 L", jual 55.000, beli 40.000, stok 20 botol), kampas ("Kampas Rem Depan Vario", jual 75.000, beli 50.000, stok 10 set), pelanggan, kendaraan}`; nama jasa diberi akhiran unik |
| `spkBengkel(b, ubah?)` | SPK baru untuk kendaraan bengkel, dibuat kasir |
| `spkBerisi(b, {denganMekanik?})` | SPK berisi Ganti Oli + 1 Oli = Rp90.000 |
| `detikDari(teksWaktu, acuan?)` | selisih detik |

### `src/db.ts`: database uji

| Fungsi | Keterangan |
|---|---|
| `baca(sql, nilai?)`, `bacaSatu(sql, nilai?)`, `jalankan(sql, nilai?)` (jumlah baris terubah), `jumlahBaris(tabel, where?, nilai?)` | akses mentah; `TABEL` = 16 tabel |
| `kosongkanDatabase()` | semua tabel + baris awal migration (dipanggil otomatis sebelum setiap berkas) |
| `kosongkanSpkDanBooking()` | SPK, booking, item, pembayaran, linimasa, pesan WA, dan kedua penghitung; menolak bila ada kartu stok milik SPK |
| `kosongkanStaf()` | staf, sesi, `login_attempts`; menolak bila ada SPK, kartu stok, atau booking yang ditangani staf |
| `sisipkanStaf({name, email, role, passwordHash, aktif?})` → `staffId`; `sisipkanSesi(staffId, {kedaluwarsaDetik?})` → token; `geserSesi(token, {kedaluwarsaDetik, terakhirDipakaiDetikLalu})`; `waktuSesi(token)` → `{sisa, sejakDipakai}`; `peranToken(token)` | sesi dengan aturan bersama (base64url 43, SHA-256 hex) |
| `sha256Hex(teks)`, `waktuDatabase(): Date`, `tanggalWib(geserHari = 0)` → `'YYYY-MM-DD'` | jam database, bukan jam mesin tes |
| `aturPenghitung('work_order_number' \| 'booking_number', nilai)`, `nilaiPenghitung(nama)` | mis. 9998 untuk `S-9999 → S-10000` |
| `setAktif('services' \| 'parts' \| 'staff', id, aktif)` | ubah langsung di database |
| `idSpk(nomor)`, `idBooking(nomor)` | |
| `barisSpk(nomor)` (termasuk `tracking_token`, `created_by_staff_id`), `barisItemSpk(nomor)` (termasuk `cost_price`, urut `line_no`), `barisLogSpk(nomor)`, `barisBooking(nomor)` (termasuk `booking_token_hash`; `visit_date` berupa teks), `barisPart(partId)` (termasuk `cost_price`, `stock`), `barisKartuStok(partId)` (dari yang terlama) | kolom mentah yang tidak ada di API |
| `sparepartTidakCocokKartu(): string[]` | SKU yang jumlah `quantity` kartu stoknya ≠ `stock` (harus kosong) |
| `barisWa(where?, nilai?)`, `barisWaSpk(nomor, jenis?)`, `barisWaBooking(nomor, jenis?)` → `BarisWa[]` | `body`, `status`, `failure_reason`, urut `created_at` |
| `aturWaktuSpk(nomor, waktu)` (ikut linimasa pertama), `aturWaktuLogSpk(nomor, keStatus, waktu)`, `aturWaktuPembayaran(paymentId, waktu)`, `aturWaktuBooking(nomor, waktu)`, `aturTanggalDatang(nomor, 'YYYY-MM-DD')` | penetapan waktu UTC persis; `waktu` = `Date`, ISO berakhiran `Z`, atau `"YYYY-MM-DD HH:MM:SS.mmm"` UTC (`teksUtc`) |
| `urutkanSpk(nomorDariTerlama)`, `urutkanBooking(nomorDariTerlama)` (berselang 1 jam), `urutkanKartuStok(movementIdDariTerlama)` (berselang 1 detik) | urutan daftar yang tidak bergantung pada kecepatan backend |

### `src/format.ts`: nilai dan pesan yang diharapkan (ditulis ulang dari spec)

| Fungsi | Keterangan |
|---|---|
| `rupiah(n)`, `angka(n)`, `tanggal('YYYY-MM-DD')` → `DD-MM-YYYY`, `waktuWib(iso)` → `DD-MM-YYYY HH:MM WIB` | whatsapp.md bagian 4 |
| `tanggalWibDari(waktu)`, `rentangUtcTanggalWib(tgl)` → `{mulai, akhir}`, `geserTanggal(tgl, hari)` | filter `date` dan rekap |
| `nomorSpk(n)`, `nomorBooking(n)` | `S-0001`, `B-10000` |
| `pangkas(teks)`, `normalisasiHp(x)` → `{nilai}` atau `{galat}`, `hpSeragam(teks)`, `samarkanHp(seragam)`, `normalisasiPlat(x)` → `{nilai: {kunci, tampilan}}` atau `{galat}`, `plat(teks)` | skema `NomorHpMasukan`, `NomorHpSamaran`, `PlatMasukan` |
| `hitungTotal(items)`, `statusBayar(total, paidAmount)`, `LABEL_STATUS_SPK` | |
| `pesanStokKurang({name, unit, butuh, tersedia})` | pesan 409 `insufficient_stock` |
| `pesanBookingDikonfirmasi(outlet, {number, plate, visitDate, serviceName})`, `pesanBookingDitolak(outlet, {number, plate, visitDate, rejectReason}, publicWebUrl)`, `pesanSpkDibuat(outlet, spk, tautan)`, `pesanSiapDiambil(outlet, spk, tautan)`, `pesanNota(outlet, spk, tautan)` | lima templat whatsapp.md bagian 5; `spk` boleh langsung `SpkDetail` dan `outlet` langsung `Outlet` |
| `tautanLacak(publicWebUrl, trackingToken)`, `teksKendaraan(v)`, `salam(nama)`, `OUTLET_AWAL` | `publicWebUrl` dari `bacaEnv().publicWebUrl` |

`npm run cek-harness` membuktikan semua fungsi di atas sama dengan contoh yang dibaca langsung
dari spec (7 contoh pesan, tabel plat dan HP, samaran, contoh `insufficient_stock`, `x-label`).

### `src/wa.ts`, `src/banding.ts`, `src/env.ts`, `src/spec.ts`

| Fungsi | Keterangan |
|---|---|
| `waPalsu.untuk(nomor)`, `terakhir(nomor)`, `semua()`, `permintaan()`, `gangguan({gagal, nomor?, mode?})`, `jeda(ms, nomor?)`, `tungguDikirim(nomor, batasMs?)`, `reset()`, `ping()` | kendali WhatsApp palsu; isi pesan sudah CRLF → LF |
| `harapSetara(aktual, harapan, pesan?)` | `toEqual` dengan field berakhiran `At` dianggap sama bila selisih ≤ 2 ms |
| `bacaEnv()` → `{baseUrl, databaseUrl, waPalsuUrl, waToken, setupToken, publicWebUrl, tungguBackendDetik}`, `NILAI_UJI` | |
| `muatSpec()`, `skemaKomponen(nama)`, `labelSpec(nama)`, `pesanBaku()`, `cariOperasi(metode, path)` | spec yang dibundel (`.spec-bundel/openapi.json`) |

### `tes/pembantu-fondasi.ts`

`mintaLangsung(metode, path, {header?, badan?, jenis?})` (tanpa validasi spec, tanpa mengikuti
pengalihan), `bentukNotFound(res)` + `NOT_FOUND_JSON`, `JSON_RUSAK`, `jsonLebihDariSatuMib()`,
`badanUtf8Rusak()`, `tokenAcak()` (43 karakter sah yang tidak pernah diterbitkan),
`tukarHuruf(token)`, `SATU_MIB`, `SEHARI`.

### Konvensi tambahan untuk produk ini

- Waktu "hari ini" untuk booking dan filter tanggal diambil dari `tanggalWib()`, bukan
  `new Date()`. Hindari menjalankan tes tepat sekitar 17.00 UTC (tengah malam WIB).
- Pesan WhatsApp dibandingkan dengan fungsi `pesan…` dari `src/format.ts` dan
  `bacaEnv().publicWebUrl`; datanya diambil dari respons API saat pesan dikirim.
- Kebocoran `costPrice` untuk kasir dan mekanik sudah ditolak otomatis oleh klien; tes tetap
  menulis harapan eksplisit (mis. `expect('costPrice' in baris).toBe(false)`) supaya aturannya
  terbaca.
- Kasus mekanik: buat SPK dengan `mechanicId: b.mekanik.staff.staffId`; SPK tanpa mekanik yang
  dibuka mekanik → 403.
