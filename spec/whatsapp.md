# Pesan WhatsApp

Backend mengirim lima jenis pesan WhatsApp ke pelanggan: booking dikonfirmasi, booking ditolak,
SPK dibuat (dengan tautan lacak), servis selesai dan siap diambil, dan nota. Tidak ada kode OTP,
karena pelanggan tidak punya akun. Dokumen ini menetapkan permintaan ke penyedia WhatsApp dan
isi setiap pesan **byte demi byte**, sehingga semua backend mengirim teks yang sama persis dan
bisa dibandingkan dengan tes.

## 1. Penyedia: bentuk API kirim Fonnte

Antarmuka kirim meniru API kirim **Fonnte**, penyedia WhatsApp yang umum di Indonesia, sama
dengan produk KodeCoding lain (laundry, kafe-resto). Pembeli yang memakai Fonnte cukup mengisi
`WA_API_URL` dan `WA_TOKEN`; penyedia lain dengan bentuk berbeda butuh penyesuaian kecil di satu
tempat (klien WhatsApp backend).

**Pengecekan ke dokumentasi resmi**: 27-11-2026, halaman
<https://docs.fonnte.com/api-send-message/> ("Sending API Messages"). Halaman itu tidak
mencantumkan tanggal pembaruan. Isinya sama dengan yang dicatat kafe-resto pada 04-11-2026. Yang
terbaca di sana:

- `POST https://api.fonnte.com/send`.
- Token dikirim di header `Authorization` apa adanya; dokumentasinya menyebut "Authorization
  does not require a Bearer".
- Contoh resminya (PHP cURL dengan larik di `CURLOPT_POSTFIELDS`) mengirim badan
  `multipart/form-data`; halaman tidak menyebut jenis badan secara tertulis. Parameter `target`
  wajib (string; nomor, dipisah koma), `message` tercantum opsional (teks), dan banyak parameter
  opsional lain (`countryCode` bawaan `62` yang mengganti `0` di depan nomor, `url`, `delay`,
  `schedule`, dst.).
- Balasan sukses berupa JSON dengan `"status": true`, mis.
  `{"detail": "success! message in queue", "id": ["80367170"], "process": "pending", "requestid": 2937124, "status": true, "target": ["6282227097005"]}`.
- Balasan gagal "always return status : false" disertai `reason`, mis. `token invalid`,
  `input invalid`, `target invalid`, `insufficient quota`, `JSON format invalid`. Dua contoh
  pertama di dokumentasi menulis `"Status": false` dengan huruf besar.
- Kode status HTTP untuk sukses maupun gagal **tidak** didokumentasikan; keberhasilan hanya
  terbaca dari `status` di badan.

Yang tidak bisa dipastikan dari dokumentasi, sehingga sengaja tidak dipakai: badan
`application/json` atau `application/x-www-form-urlencoded`, dan perilaku kode status HTTP.
Kontrak di bawah hanya memakai bagian yang tertulis jelas.

**Belum diuji dengan akun Fonnte sungguhan.** Seluruh pengujian memakai WhatsApp palsu
(bagian 6).

## 2. Permintaan backend → penyedia

```
POST {WA_API_URL}
Authorization: {WA_TOKEN}
Content-Type: multipart/form-data; boundary=<bebas>

target  = <nomor tujuan bentuk 628…>
message = <isi pesan, bagian 5>
```

- `WA_API_URL` adalah alamat lengkap, termasuk path (`https://api.fonnte.com/send` untuk
  Fonnte; `http://localhost:8892/send` untuk WhatsApp palsu uji Laravel).
- Header `Authorization` berisi `WA_TOKEN` persis, **tanpa** awalan `Bearer`.
- Badan `multipart/form-data` dengan **tepat dua** field teks, `target` dan `message`,
  masing-masing sekali. Tidak ada `countryCode` atau field lain: nomor sudah berbentuk `628…`.
- Satu permintaan = satu pesan = satu nomor tujuan.
- Pergantian baris di `message` ditulis LF. Pustaka `multipart` yang mengikuti standar HTML
  (mis. `FormData` di Node) mengubahnya menjadi CRLF; itu boleh. Penerima dan tes membandingkan
  isi sesudah CRLF diganti LF.
- Batas waktu 10 detik untuk seluruh permintaan: balasan yang tiba sebelum 10 detik wajib
  ditunggu (balasan sesudah 8 detik tetap bisa terkirim), sedangkan penyedia yang belum membalas
  sesudah 10 detik dianggap gagal (waktu habis) dan backend tidak menunggu lebih lama.

**Dianggap terkirim** hanya bila: status HTTP 2xx **dan** badannya objek JSON **dan** field
`status` bernilai boolean `true`. Selain itu gagal, termasuk status HTTP lain, badan bukan JSON,
`"status": false`, `"Status": false` tanpa `status`, galat jaringan, dan waktu habis.

Saat mencatat kegagalan (`failure_reason`, log), tulis alasan singkat yang bisa dibaca manusia.
Bila badan penyedia berupa objek JSON dengan `reason` bertipe string, itulah alasannya. Selain
itu isinya bebas tetapi tidak kosong, mis. `HTTP 500`, `waktu habis`, atau `koneksi terputus`;
bunyinya tidak dibandingkan tes. Urutannya:

1. setiap kemunculan `WA_TOKEN` di dalam alasan diganti `***`;
2. hasilnya dipotong menjadi paling banyak 255 **karakter** (code point Unicode, bukan byte);
3. alasan yang kosong diganti teks lain yang tidak kosong (kolom ini wajib terisi untuk pesan
   gagal).

`WA_TOKEN` tidak pernah ditulis ke log, database, atau balasan API.

## 3. Kapan pesan dikirim dan dicatat

| Jenis (`wa_messages.type`) | Dikirim otomatis saat | Kirim ulang kasir | Nomor tujuan otomatis |
|---|---|---|---|
| `booking_confirmed` | booking dikonfirmasi (`POST /api/bookings/{id}/confirm`) | tidak ada | nomor di booking |
| `booking_rejected` | booking ditolak (`POST /api/bookings/{id}/reject`) | tidak ada | nomor di booking |
| `work_order_created` | SPK dibuat (`POST /api/work-orders`, atau booking dijadikan SPK) | `POST /api/work-orders/{number}/wa`, selama SPK tidak `CANCELLED` | nomor pelanggan |
| `work_order_done` | status SPK menjadi `DONE` | idem, hanya untuk SPK `DONE` atau `PICKED_UP` | nomor pelanggan |
| `receipt` | **tidak pernah otomatis** | idem, selama SPK tidak `CANCELLED` | nomor pelanggan (atau `phone` di badan) |

- **Tidak ada pesan dari form publik.** `POST /api/public/bookings` tidak mengirim apa pun,
  karena nomor di form bisa milik orang lain. Pesan booking baru dikirim sesudah **staf**
  mengonfirmasi atau menolaknya, satu kali per tindakan, dan isinya tidak memuat teks bebas
  ketikan pemesan (nama, merek, keluhan), hanya nomor booking, plat dalam bentuk tampilan
  (`PlatTampilan`, bagian 4, mis. `B 1234 XYZ`; hanya huruf, angka, dan spasi), tanggal, nama
  jasa dari katalog, dan teks milik bengkel. Jadi yang bisa sampai ke nomor orang lain hanya
  teks milik bengkel.
- Pesan SPK dikirim ke nomor pelanggan yang dicatat kasir saat pelanggan datang, jadi memuat
  nama pelanggan dan tidak dibatasi jumlahnya.
- Pengiriman sinkron di dalam permintaan HTTP, **sesudah transaksinya di-commit**, bukan lewat
  antrean dan bukan di dalam transaksi. Hasilnya sudah tercatat sebelum balasan HTTP dikirim.
- Pengiriman otomatis yang gagal tidak menggagalkan permintaan (balasan tetap 2xx dan status
  pesannya `failed`). Kirim ulang kasir yang gagal → 503 `wa_unavailable`; baris `failed`
  tetap tercatat.
- Setiap percobaan kirim = satu baris `wa_messages`: `type`, `phone` (nomor tujuan), `body`,
  `status` (`sent`/`failed`), `failure_reason` (`NULL` bila terkirim), `booking_id` (pesan
  booking) **atau** `work_order_id` (pesan SPK), `created_at`.
- `body` = isi `message` persis seperti dikirim (LF).
- Semua nilai di pesan diambil **saat pesan dikirim**: data pelanggan dan kendaraan saat ini,
  profil outlet, item, pembayaran, dan token lacak saat itu.
- `wa` di rincian SPK (`RingkasanWa`) dan booking (`RingkasanWaBooking`) membaca baris terbaru
  per jenis: `ORDER BY created_at DESC, wa_message_id DESC`.

## 4. Format nilai

Semua bilangan ditulis dengan digit ASCII, tanpa spasi.

| Nilai | Aturan | Contoh |
|---|---|---|
| `rupiah(x)` | `Rp` + angka bulat dengan titik setiap tiga digit dari kanan | `Rp0`, `Rp7`, `Rp500`, `Rp35.000`, `Rp150.000`, `Rp1.250.000` |
| `tanggal(d)` | tanggal `DATE` (sudah WIB) ditulis `DD-MM-YYYY`, dua digit dengan nol di depan | `2026-11-27` → `27-11-2026` |
| `waktu(t)` | UTC + 7 jam, format `DD-MM-YYYY HH:MM WIB`, 24 jam, dua digit dengan nol di depan; detik dan milidetik dibuang (bukan dibulatkan) | `2026-11-27T07:05:59.999Z` → `27-11-2026 14:05 WIB`; `2026-11-27T17:00:00Z` → `28-11-2026 00:00 WIB` |
| `{plate}` | plat tampilan (`PlatTampilan`) | `B 1234 XYZ` |
| `{kendaraan}` | `{plate} ({brand} {model})`; bila `model` kosong `{plate} ({brand})` | `B 1234 XYZ (Honda Vario 125)`, `D 1 (Toyota)` |
| `{salam}` | `Halo {customer.name}` (satu spasi) | `Halo Budi Santoso` |
| `{tautanLacak}` | `{PUBLIC_WEB_URL}/servis/{trackingToken}` (garis miring akhir `PUBLIC_WEB_URL` sudah dibuang) | `https://bengkelku.id/servis/Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk` |
| `{label(status)}` | label Indonesia status SPK (`x-label` `StatusSpk`) | `Antre`, `Dikerjakan`, `Menunggu part`, `Selesai`, `Diambil` |

Teks lain (nama outlet, alamat, jam buka, nama pelanggan, nama jasa dan sparepart, nomor SPK
dan booking, alasan tolak, kaki nota) ditulis apa adanya seperti tersimpan, termasuk
pergantian baris di dalamnya.

## 5. Templat

Notasi: `{…}` diganti nilainya; baris diakhiri LF; pesan **tidak** diakhiri LF dan tidak ada
spasi di akhir baris yang tidak berasal dari nilai. Pesan terdiri dari **blok** yang dipisah
satu baris kosong. Baris bertanda *opsional* dihilangkan bila nilainya kosong (string kosong
atau `null`); blok yang semua barisnya hilang dihapus bersama satu baris kosong di depannya,
sehingga tidak pernah ada dua baris kosong berurutan atau baris kosong di akhir pesan.

### 5.1 Booking dikonfirmasi (`booking_confirmed`)

```text
{outlet.name}
Booking {number}

Halo, booking servis kamu untuk {plate} pada {tanggal(visitDate)} sudah dikonfirmasi.

Jasa: {serviceName}

Alamat: {outlet.address}
Jam buka: {outlet.openingHours}
```

- Baris `Jasa:` *opsional* (booking tanpa jasa). `serviceName` adalah salinan nama saat booking
  dibuat.
- Baris `Alamat:` dan `Jam buka:` masing-masing *opsional*.
- Tidak memuat nama pemesan (bagian 3).

Contoh (booking dengan jasa, outlet lengkap):

```text
Bengkel Maju Jaya
Booking B-0007

Halo, booking servis kamu untuk B 1234 XYZ pada 28-11-2026 sudah dikonfirmasi.

Jasa: Ganti Oli

Alamat: Jl. Merdeka No. 10, Bandung
Jam buka: Senin–Sabtu 08.00–17.00
```

Contoh (tanpa jasa, alamat dan jam buka outlet kosong):

```text
Nama Bengkel
Booking B-0008

Halo, booking servis kamu untuk D 1 pada 01-12-2026 sudah dikonfirmasi.
```

### 5.2 Booking ditolak (`booking_rejected`)

```text
{outlet.name}
Booking {number}

Halo, mohon maaf, booking servis kamu untuk {plate} pada {tanggal(visitDate)} belum bisa kami terima.

Alasan: {rejectReason}

Silakan booking ulang di {PUBLIC_WEB_URL}/booking
```

Contoh:

```text
Bengkel Maju Jaya
Booking B-0007

Halo, mohon maaf, booking servis kamu untuk B 1234 XYZ pada 28-11-2026 belum bisa kami terima.

Alasan: Bengkel tutup tanggal itu, silakan pilih tanggal lain.

Silakan booking ulang di https://bengkelku.id/booking
```

### 5.3 SPK dibuat (`work_order_created`)

```text
{outlet.name}
SPK {number}

{salam}, kendaraan kamu sudah kami terima untuk diservis.

Kendaraan: {kendaraan}
Estimasi selesai: {waktu(estimatedDoneAt)}

Pantau status servis dan nota di:
{tautanLacak}
```

- Baris `Estimasi selesai:` *opsional* (`estimatedDoneAt` `null`).

Contoh (dengan estimasi `2026-11-28T08:00:00.000Z`):

```text
Bengkel Maju Jaya
SPK S-0012

Halo Budi Santoso, kendaraan kamu sudah kami terima untuk diservis.

Kendaraan: B 1234 XYZ (Honda Vario 125)
Estimasi selesai: 28-11-2026 15:00 WIB

Pantau status servis dan nota di:
https://bengkelku.id/servis/Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk
```

### 5.4 Siap diambil (`work_order_done`)

```text
{outlet.name}
SPK {number}

{salam}, servis {plate} sudah selesai dan kendaraan siap diambil.

Total: {rupiah(total)}
Dibayar: {rupiah(paidAmount)}
Sisa: {rupiah(total − paidAmount)}

Rincian dan nota:
{tautanLacak}

Jam buka: {outlet.openingHours}
```

- Blok `Jam buka:` *opsional*.

Contoh:

```text
Bengkel Maju Jaya
SPK S-0012

Halo Budi Santoso, servis B 1234 XYZ sudah selesai dan kendaraan siap diambil.

Total: Rp165.000
Dibayar: Rp50.000
Sisa: Rp115.000

Rincian dan nota:
https://bengkelku.id/servis/Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk

Jam buka: Senin–Sabtu 08.00–17.00
```

### 5.5 Nota (`receipt`)

```text
{outlet.name}
Nota SPK {number}

{salam}, terima kasih sudah servis di {outlet.name}.

Kendaraan: {kendaraan}
Waktu: {waktu(createdAt)}
Status: {label(status)}

{satu baris per item}

Jasa: {rupiah(serviceSubtotal)}
Sparepart: {rupiah(partSubtotal)}
Total: {rupiah(total)}
Dibayar: {rupiah(paidAmount)}
Sisa: {rupiah(total − paidAmount)}

Nota online:
{tautanLacak}

{outlet.receiptFooter}
```

- `createdAt` adalah waktu SPK dibuat.
- Baris item, urut seperti di SPK (nomor baris naik), jasa dan sparepart bercampur:
  `- {name}: {quantity} x {rupiah(price)} = {rupiah(subtotal)}`. SPK tanpa item → blok ini
  berisi satu baris `Belum ada item.`
- Blok `{outlet.receiptFooter}` *opsional*; boleh berisi pergantian baris dan ditulis apa
  adanya.
- Harga beli tidak pernah ada di nota.

Contoh (SPK S-0012, sudah dibayar uang muka Rp50.000):

```text
Bengkel Maju Jaya
Nota SPK S-0012

Halo Budi Santoso, terima kasih sudah servis di Bengkel Maju Jaya.

Kendaraan: B 1234 XYZ (Honda Vario 125)
Waktu: 28-11-2026 08:15 WIB
Status: Selesai

- Ganti Oli: 1 x Rp35.000 = Rp35.000
- Oli Mesin 10W-40 0,8 L: 1 x Rp55.000 = Rp55.000
- Kampas Rem Depan Vario: 1 x Rp75.000 = Rp75.000

Jasa: Rp35.000
Sparepart: Rp130.000
Total: Rp165.000
Dibayar: Rp50.000
Sisa: Rp115.000

Nota online:
https://bengkelku.id/servis/Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk

Garansi servis 7 hari.
```

Contoh (SPK tanpa item, kaki nota kosong, motor tanpa tipe):

```text
Nama Bengkel
Nota SPK S-0013

Halo Ani, terima kasih sudah servis di Nama Bengkel.

Kendaraan: D 1 (Yamaha)
Waktu: 28-11-2026 09:00 WIB
Status: Antre

Belum ada item.

Jasa: Rp0
Sparepart: Rp0
Total: Rp0
Dibayar: Rp0
Sisa: Rp0

Nota online:
http://localhost:3800/servis/Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk
```

## 6. WhatsApp palsu untuk dev dan tes

`tests/wa-palsu` (dibuat Bagian 0b) meniru `POST /send` di atas, menyimpan pesan di memori, dan
menampilkannya di browser per nomor tujuan. Pesan tidak pernah sampai ke WhatsApp sungguhan.
Port: 8890 untuk dev, 8891/8892/8893 untuk tes kontrak backend Go/Laravel/NestJS, 8814-8816
untuk E2E. Perilaku dan endpoint kendalinya mengikuti WhatsApp palsu kafe-resto: penolakannya
meniru Fonnte (balasan HTTP 200 dengan `"status": false` dan `reason` untuk token salah, badan
bukan `multipart/form-data`, field selain tepat `target` dan `message`, atau `target` yang bukan
satu nomor `628…`), sehingga backend yang hanya memeriksa status HTTP akan salah mencatat pesan
gagal sebagai terkirim, dan tes menangkapnya. Mode gangguan `status-besar` membalas
`{"Status": false, "reason": …}` tanpa `status` (bagian 2: gagal), dan jeda balasan bisa diatur
sampai 15 detik, sehingga batas waktu 10 detik bisa diuji: pesan yang ditinggal pengirim sebelum
jedanya habis tidak disimpan. Rincian dan cara menyalakannya ditulis Bagian 0b di
`docs/menjalankan.md`.
