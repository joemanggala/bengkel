// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pembantu khusus tes booking (booking-publik*, booking-staf*, konversi-booking*).
// Semua pembuat data melempar (bukan expect) bila backend membalas di luar yang
// diharapkan, sama seperti src/data.ts.

import { randomBytes } from 'node:crypto';
import { buatBookingPublik, jadikanSpk, konfirmasiBooking, tolakBooking, wajib, type Bengkel, type BookingBaru } from '../src/data';
import { baca, barisBooking, jalankan, jumlahBaris, nilaiPenghitung, sha256Hex, tanggalWib, waktuDatabase } from '../src/db';
import { api, type OpsiMinta, type Respons } from '../src/klien';

export const STATUS_BOOKING = ['PENDING', 'CONFIRMED', 'CONVERTED', 'REJECTED', 'CANCELLED'] as const;
export type StatusBooking = (typeof STATUS_BOOKING)[number];

// Kunci BookingPublik dan Booking (skema tertutup; daftar ini membuat aturan
// "tanpa ID, tanpa data staf, tanpa status WhatsApp" terbaca di tes).
export const FIELD_BOOKING_PUBLIK = [
  'number',
  'status',
  'customerName',
  'phone',
  'vehicleType',
  'plate',
  'vehicleBrand',
  'vehicleModel',
  'serviceName',
  'visitDate',
  'complaint',
  'rejectReason',
  'workOrderNumber',
  'createdAt',
];

export const FIELD_BOOKING_STAF = [
  'bookingId',
  'number',
  'status',
  'customerName',
  'phone',
  'vehicleType',
  'plate',
  'plateKey',
  'vehicleBrand',
  'vehicleModel',
  'service',
  'visitDate',
  'complaint',
  'rejectReason',
  'workOrderNumber',
  'handledBy',
  'wa',
  'createdAt',
  'updatedAt',
];

export const POLA_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const ALASAN_TOLAK = 'Bengkel tutup tanggal itu, silakan pilih tanggal lain.';

export function tidur(ms: number): Promise<void> {
  return new Promise((selesai) => setTimeout(selesai, ms));
}

// --- Rute publik -------------------------------------------------------------

export const kirimBooking = (json: unknown, opsi: OpsiMinta = {}): Promise<Respons> => api.post('/api/public/bookings', { ...opsi, json });
export const lihatBookingPublik = (token: string, opsi: OpsiMinta = {}): Promise<Respons> => api.get(`/api/public/bookings/${token}`, opsi);
export const batalkanBookingPublik = (token: string, opsi: OpsiMinta = {}): Promise<Respons> =>
  api.post(`/api/public/bookings/${token}/cancel`, opsi);

// --- Rute staf ---------------------------------------------------------------

export const daftarBooking = (token: string, query: Record<string, string | number | undefined> = {}): Promise<Respons> =>
  api.get('/api/bookings', { token, query });
export const rincianBooking = (token: string | undefined, bookingId: string): Promise<Respons> => api.get(`/api/bookings/${bookingId}`, { token });
export const konfirmasi = (token: string | undefined, bookingId: string, opsi: OpsiMinta = {}): Promise<Respons> =>
  api.post(`/api/bookings/${bookingId}/confirm`, { ...opsi, token });
// Badan `json` dipakai kecuali `opsi` membawa badan mentah atau biner (untuk
// menguji 400 dan 413).
function denganBadan(token: string | undefined, json: unknown, opsi: OpsiMinta): OpsiMinta {
  return opsi.mentah !== undefined || opsi.biner !== undefined ? { ...opsi, token } : { ...opsi, token, json };
}

export const tolak = (token: string | undefined, bookingId: string, json: unknown = { reason: ALASAN_TOLAK }, opsi: OpsiMinta = {}): Promise<Respons> =>
  api.post(`/api/bookings/${bookingId}/reject`, denganBadan(token, json, opsi));
export const konversi = (token: string | undefined, bookingId: string, json: unknown = {}, opsi: OpsiMinta = {}): Promise<Respons> =>
  api.post(`/api/bookings/${bookingId}/convert`, denganBadan(token, json, opsi));

// Booking yang sudah berada di `status`, lewat rute yang sah (lihat "Status
// booking"). Konfirmasi, tolak, dan konversi dilakukan kasir bengkel.
export async function bookingBerstatus(b: Bengkel, status: StatusBooking, ubah: Record<string, unknown> = {}): Promise<BookingBaru> {
  const baru = await buatBookingPublik(ubah);
  if (status === 'CONFIRMED') {
    await konfirmasiBooking(b.kasir.token, baru.bookingId);
  } else if (status === 'REJECTED') {
    await tolakBooking(b.kasir.token, baru.bookingId);
  } else if (status === 'CANCELLED') {
    wajib(await batalkanBookingPublik(baru.bookingToken), 200);
  } else if (status === 'CONVERTED') {
    await jadikanSpk(b.kasir.token, baru.bookingId);
  }
  return baru;
}

// --- Token -------------------------------------------------------------------

// Token berbentuk sah (43 karakter base64url) yang tidak pernah diterbitkan.
export function tokenAcak(): string {
  return randomBytes(32).toString('base64url');
}

// Bentuk token yang salah. Semuanya aman ditaruh di path (tanpa "/", "?", "#").
export function tokenBentukBuruk(): Array<[string, string]> {
  const sah = tokenAcak();
  return [
    ['42 karakter', sah.slice(0, 42)],
    ['44 karakter', `${sah}A`],
    ['berpadding "="', `${sah.slice(0, 42)}=`],
    ['memuat "+" (base64 biasa)', `${sah.slice(0, 42)}+`],
    ['memuat titik', `${sah.slice(0, 42)}.`],
    ['memuat spasi (%20)', `${sah.slice(0, 42)}%20`],
    ['satu huruf', 'a'],
    ['hex SHA-256 64 karakter', sha256Hex(sah)],
    ['43 karakter dengan tanda kutip', `'${sah.slice(0, 41)}'`],
  ];
}

// Menukar huruf besar dan kecil; undefined bila tidak ada huruf yang berubah.
export function tukarHuruf(token: string): string | undefined {
  const hasil = [...token].map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join('');
  return hasil === token ? undefined : hasil;
}

// --- Nomor HP ----------------------------------------------------------------

// Tiga bentuk ketikan yang sah untuk satu nomor seragam 628… (NomorHpMasukan).
export function variasiHp(seragam: string): { lokal: string; internasional: string; polos: string } {
  const sisa = seragam.slice(2);
  return {
    lokal: `0${sisa.slice(0, 3)}-${sisa.slice(3, 7)}-${sisa.slice(7)}`,
    internasional: `+62 ${sisa.slice(0, 3)} ${sisa.slice(3, 7)} ${sisa.slice(7)}`,
    polos: seragam,
  };
}

// --- Waktu -------------------------------------------------------------------

const SEHARI_MS = 24 * 60 * 60 * 1000;
const TUJUH_JAM_MS = 7 * 60 * 60 * 1000;

// Tanggal WIB (jam database) digeser `geserHari`. Bila tengah malam WIB tinggal
// kurang dari 5 detik, ditunggu dulu sampai lewat, supaya tanggal yang dihitung
// tes sama dengan tanggal yang dinilai backend saat permintaan tiba.
export async function tanggalWibAman(geserHari = 0): Promise<string> {
  const sekarang = (await waktuDatabase()).getTime();
  const sisa = SEHARI_MS - ((sekarang + TUJUH_JAM_MS) % SEHARI_MS);
  if (sisa < 5000) {
    await tidur(sisa + 1000);
  }
  return tanggalWib(geserHari);
}

// --- Database ----------------------------------------------------------------

// Kolom tabel bookings yang memuat `teks` (untuk membuktikan token booking
// tidak tersimpan apa adanya di mana pun).
export async function kolomBookingMemuat(nomor: string, teks: string): Promise<string[]> {
  const [baris] = await baca<Record<string, unknown>>('SELECT * FROM bookings WHERE number = ?', [nomor]);
  if (!baris) {
    throw new Error(`Booking ${nomor} tidak ada di database`);
  }
  return Object.entries(baris)
    .filter(([, nilai]) => nilai !== null && String(nilai).includes(teks))
    .map(([kolom]) => kolom);
}

// Menetapkan booking_token_hash langsung, seperti booking yang dibuat backend
// lain dengan aturan bersama (hex SHA-256 atas byte ASCII token).
export async function gantiHashToken(nomor: string, token: string): Promise<void> {
  if ((await jalankan('UPDATE bookings SET booking_token_hash = ? WHERE number = ?', [sha256Hex(token), nomor])) !== 1) {
    throw new Error(`Booking ${nomor} tidak ditemukan`);
  }
}

// Badan JSON bersarang `tingkat` lapis di field yang tidak dikenal (field
// lain di badan diabaikan, jadi hanya kedalamannya yang dinilai).
export function badanBersarang(isian: Record<string, unknown>, tingkat: number): string {
  const json = JSON.stringify(isian);
  return `${json.slice(0, -1)},"lain":${'['.repeat(tingkat)}${']'.repeat(tingkat)}}`;
}

// Keadaan yang tidak boleh berubah oleh konversi yang ditolak: baris booking,
// jumlah pelanggan, kendaraan, SPK, pesan WhatsApp, dan penghitung nomor SPK.
export async function jejakKonversi(nomorBooking: string): Promise<unknown> {
  const baris = await barisBooking(nomorBooking);
  return {
    status: baris.status,
    staf: baris.handled_by_staff_id,
    spkBooking: baris.work_order_id,
    pelanggan: await jumlahBaris('customers'),
    kendaraan: await jumlahBaris('vehicles'),
    spk: await jumlahBaris('work_orders'),
    item: await jumlahBaris('work_order_items'),
    wa: await jumlahBaris('wa_messages'),
    penghitung: await nilaiPenghitung('work_order_number'),
  };
}
