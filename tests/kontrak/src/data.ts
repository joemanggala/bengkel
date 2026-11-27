// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import fixtur from '../fixtur/bcrypt.json';
import { idBooking, sisipkanStaf, tanggalWib, type PeranStaf } from './db';
import { api, ringkas, type Respons } from './klien';

// Pembuat data uji lewat API. Semua fungsi melempar (bukan expect) bila
// backend membalas di luar yang diharapkan, supaya kegagalan persiapan data
// tidak tertukar dengan kegagalan aturan yang sedang diuji.

export const SANDI_UJI = fixtur.sandi;

export interface Staf {
  staffId: string;
  name: string;
  email: string;
  role: PeranStaf;
  isActive: boolean;
  createdAt: string;
}

export interface SesiStaf {
  token: string;
  staff: Staf;
}

let urutan = 0;

function unik(): string {
  urutan += 1;
  return `${Date.now().toString(36)}${urutan}`;
}

export function emailUnik(awalan = 'staf'): string {
  return `${awalan}-${unik()}@contoh.id`;
}

// Nama yang tidak pernah sama di satu proses tes (nama jasa wajib unik).
export function namaUnik(awalan: string): string {
  return `${awalan} ${unik()}`;
}

// Nomor 628… 13 digit yang tidak pernah sama di satu proses tes.
export function nomorUnik(): string {
  urutan += 1;
  return `6281${String(Date.now()).slice(-6)}${String(urutan % 1000).padStart(3, '0')}`;
}

const HURUF = 'ABCDEFGHJKLMNPRSTUVWXYZ';

// Plat tampilan berpola huruf-angka-huruf ("B 1234 XYZ"), unik di satu proses
// tes. Kuncinya 8 karakter, jadi bentuk tampilan dan kunci selalu sah.
export function platUnik(awalan = 'B'): string {
  urutan += 1;
  const n = urutan + Math.floor(Date.now() / 1000);
  const belakang = [0, 1, 2].map((i) => HURUF[Math.floor(n / HURUF.length ** i) % HURUF.length]).join('');
  return `${awalan} ${String(1000 + (urutan % 9000))} ${belakang}`;
}

// SKU unik (huruf besar, angka, tanda hubung).
export function skuUnik(awalan = 'SKU'): string {
  return `${awalan}-${unik().toUpperCase()}`;
}

export function wajib(res: Respons, ...status: number[]): Respons {
  if (!status.includes(res.status)) {
    throw new Error(`Persiapan data gagal, diharapkan ${status.join('/')}: ${ringkas(res)}`);
  }
  return res;
}

// --- Staf --------------------------------------------------------------------

export async function masukStaf(email: string, password = SANDI_UJI): Promise<SesiStaf> {
  return wajib(await api.post('/api/staff/login', { json: { email, password } }), 200).body.data;
}

const NAMA_PERAN: Record<PeranStaf, { awalan: string; nama: string }> = {
  owner: { awalan: 'pemilik', nama: 'Pemilik Uji' },
  cashier: { awalan: 'kasir', nama: 'Kasir Uji' },
  mechanic: { awalan: 'mekanik', nama: 'Mekanik Uji' },
};

// Staf disisipkan langsung ke database dengan hash bcrypt fixtur (sandi
// SANDI_UJI), lalu masuk lewat API seperti di aplikasi.
export async function buatStaf(role: PeranStaf, opsi: { name?: string; email?: string } = {}): Promise<SesiStaf> {
  const email = opsi.email ?? emailUnik(NAMA_PERAN[role].awalan);
  await sisipkanStaf({ name: opsi.name ?? NAMA_PERAN[role].nama, email, role, passwordHash: fixtur.hash.node });
  return masukStaf(email);
}

export const buatPemilik = (opsi?: { name?: string; email?: string }) => buatStaf('owner', opsi);
export const buatKasir = (opsi?: { name?: string; email?: string }) => buatStaf('cashier', opsi);
export const buatMekanik = (opsi?: { name?: string; email?: string }) => buatStaf('mechanic', opsi);

// --- Outlet ------------------------------------------------------------------

// Mengganti profil outlet seluruhnya (PUT), dengan nilai sekarang sebagai
// dasar sehingga tes cukup menyebut field yang ingin diubah.
export async function aturOutlet(tokenPemilik: string, ubah: Record<string, unknown> = {}): Promise<any> {
  const sekarang = wajib(await api.get('/api/outlet'), 200).body.data;
  return wajib(await api.put('/api/outlet', { token: tokenPemilik, json: { ...sekarang, ...ubah } }), 200).body.data;
}

// --- Jasa dan sparepart ------------------------------------------------------

// Jasa (bentuk Jasa). Bawaan: nama unik, Rp35.000, tampil di website, aktif.
export async function buatJasa(tokenPemilik: string, ubah: Record<string, unknown> = {}): Promise<any> {
  return wajib(await api.post('/api/services', { token: tokenPemilik, json: { name: namaUnik('Jasa'), price: 35000, ...ubah } }), 201).body
    .data;
}

// Jasa yang tidak tampil di website (isPublic false): boleh dipakai di item
// SPK, tetapi booking yang memilihnya → unknown_reference.
export const buatJasaNonPublik = (tokenPemilik: string, ubah: Record<string, unknown> = {}) =>
  buatJasa(tokenPemilik, { isPublic: false, ...ubah });

// Sparepart (bentuk SparepartPemilik). Bawaan: SKU dan nama unik, satuan pcs,
// harga jual Rp55.000, harga beli Rp40.000, stok awal 10 (satu kartu stok IN
// "Stok awal"), stok minimum 2.
export async function buatPart(tokenPemilik: string, ubah: Record<string, unknown> = {}): Promise<any> {
  return wajib(
    await api.post('/api/parts', {
      token: tokenPemilik,
      json: { sku: skuUnik('PART'), name: namaUnik('Part'), unit: 'pcs', price: 55000, costPrice: 40000, initialStock: 10, minStock: 2, ...ubah },
    }),
    201,
  ).body.data;
}

export async function stokMasuk(tokenPemilik: string, partId: string, quantity: number, ubah: Record<string, unknown> = {}): Promise<any> {
  return wajib(await api.post(`/api/parts/${partId}/stock-in`, { token: tokenPemilik, json: { quantity, ...ubah } }), 200).body.data;
}

export async function stokKeluar(tokenPemilik: string, partId: string, quantity: number, note = 'Rusak'): Promise<any> {
  return wajib(await api.post(`/api/parts/${partId}/stock-out`, { token: tokenPemilik, json: { quantity, note } }), 200).body.data;
}

export async function hitungStok(tokenPemilik: string, partId: string, countedStock: number, note = 'Opname'): Promise<any> {
  return wajib(await api.post(`/api/parts/${partId}/stock-count`, { token: tokenPemilik, json: { countedStock, note } }), 200).body.data;
}

// --- Pelanggan dan kendaraan -------------------------------------------------

// Pelanggan (bentuk Pelanggan). Bawaan: "Budi Santoso", nomor unik.
export async function buatPelanggan(token: string, ubah: Record<string, unknown> = {}): Promise<any> {
  return wajib(await api.post('/api/customers', { token, json: { name: 'Budi Santoso', phone: nomorUnik(), ...ubah } }), 201).body.data;
}

// Kendaraan (bentuk Kendaraan). Bawaan: motor Honda Vario 125, plat unik.
export async function tambahKendaraan(token: string, customerId: string, ubah: Record<string, unknown> = {}): Promise<any> {
  return wajib(
    await api.post(`/api/customers/${customerId}/vehicles`, {
      token,
      json: { type: 'MOTOR', plate: platUnik(), brand: 'Honda', model: 'Vario 125', ...ubah },
    }),
    201,
  ).body.data;
}

// Pelanggan beserta satu kendaraan. `pelanggan` adalah respons POST
// /api/customers (vehicles masih kosong).
export async function buatPelangganDenganKendaraan(
  token: string,
  ubahPelanggan: Record<string, unknown> = {},
  ubahKendaraan: Record<string, unknown> = {},
): Promise<{ pelanggan: any; kendaraan: any }> {
  const pelanggan = await buatPelanggan(token, ubahPelanggan);
  const kendaraan = await tambahKendaraan(token, pelanggan.customerId, ubahKendaraan);
  return { pelanggan, kendaraan };
}

// --- Booking -----------------------------------------------------------------

export interface BookingBaru {
  bookingToken: string;
  // Bentuk BookingPublik.
  booking: any;
  // ID untuk rute staf (BookingPublik tidak memuat ID), dibaca dari database.
  bookingId: string;
}

// Isian form booking publik yang sah: tanggal datang hari ini (WIB, jam
// database), nomor dan plat unik, tanpa jasa.
export async function isianBooking(ubah: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return {
    customerName: 'Budi Santoso',
    phone: nomorUnik(),
    vehicleType: 'MOTOR',
    plate: platUnik(),
    vehicleBrand: 'Honda',
    vehicleModel: 'Vario 125',
    visitDate: await tanggalWib(),
    complaint: 'Rem depan bunyi saat dipakai.',
    ...ubah,
  };
}

export async function buatBookingPublik(ubah: Record<string, unknown> = {}): Promise<BookingBaru> {
  const data = wajib(await api.post('/api/public/bookings', { json: await isianBooking(ubah) }), 201).body.data;
  return { ...data, bookingId: await idBooking(data.booking.number) };
}

// Booking untuk staf (bentuk Booking).
export async function bookingStaf(token: string, bookingId: string): Promise<any> {
  return wajib(await api.get(`/api/bookings/${bookingId}`, { token }), 200).body.data;
}

export async function konfirmasiBooking(token: string, bookingId: string): Promise<any> {
  return wajib(await api.post(`/api/bookings/${bookingId}/confirm`, { token }), 200).body.data;
}

export async function tolakBooking(token: string, bookingId: string, reason = 'Bengkel tutup tanggal itu, silakan pilih tanggal lain.'): Promise<any> {
  return wajib(await api.post(`/api/bookings/${bookingId}/reject`, { token, json: { reason } }), 200).body.data;
}

// Membalas { booking, workOrder } (HasilJadikanSpk).
export async function jadikanSpk(token: string, bookingId: string, badan: Record<string, unknown> = {}): Promise<{ booking: any; workOrder: any }> {
  return wajib(await api.post(`/api/bookings/${bookingId}/convert`, { token, json: badan }), 201).body.data;
}

// --- SPK ---------------------------------------------------------------------

// SPK baru untuk kendaraan (bentuk SpkDetail, termasuk trackingToken).
export async function buatSpk(token: string, vehicleId: string, ubah: Record<string, unknown> = {}): Promise<any> {
  return wajib(await api.post('/api/work-orders', { token, json: { vehicleId, complaint: 'Servis rutin.', ...ubah } }), 201).body.data;
}

export async function detailSpk(token: string, nomor: string): Promise<any> {
  return wajib(await api.get(`/api/work-orders/${nomor}`, { token }), 200).body.data;
}

export async function tambahItem(token: string, nomor: string, badan: Record<string, unknown>): Promise<any> {
  return wajib(await api.post(`/api/work-orders/${nomor}/items`, { token, json: badan }), 201).body.data;
}

// Item jasa; `price` hanya dikirim bila diisi (selain itu harga katalog).
export const tambahJasa = (token: string, nomor: string, serviceId: string, quantity = 1, price?: number) =>
  tambahItem(token, nomor, { type: 'SERVICE', serviceId, quantity, ...(price === undefined ? {} : { price }) });

export const tambahPart = (token: string, nomor: string, partId: string, quantity = 1) =>
  tambahItem(token, nomor, { type: 'PART', partId, quantity });

export async function hapusItem(token: string, nomor: string, itemId: string): Promise<any> {
  return wajib(await api.delete(`/api/work-orders/${nomor}/items/${itemId}`, { token }), 200).body.data;
}

export async function ubahStatus(token: string, nomor: string, status: string, note?: string): Promise<any> {
  return wajib(await api.post(`/api/work-orders/${nomor}/status`, { token, json: note === undefined ? { status } : { status, note } }), 200)
    .body.data;
}

// Jalur sah terpendek dari QUEUED ke tiap status (lihat "Status SPK").
const JALUR_STATUS: Record<string, string[]> = {
  QUEUED: [],
  IN_PROGRESS: ['IN_PROGRESS'],
  WAITING_PARTS: ['IN_PROGRESS', 'WAITING_PARTS'],
  DONE: ['IN_PROGRESS', 'DONE'],
  PICKED_UP: ['IN_PROGRESS', 'DONE', 'PICKED_UP'],
};

// Memajukan SPK yang masih QUEUED atau di jalur QUEUED → IN_PROGRESS → DONE →
// PICKED_UP sampai `tujuan`. DONE butuh minimal satu item dan PICKED_UP butuh
// lunas; keduanya tidak diurus di sini.
export async function majukanSampai(token: string, spk: { number: string; status: string }, tujuan: string): Promise<any> {
  const jalur = JALUR_STATUS[tujuan];
  if (!jalur) {
    throw new Error(`majukanSampai tidak mengenal tujuan ${tujuan}`);
  }
  const mulai = spk.status === 'QUEUED' ? 0 : jalur.indexOf(spk.status) + 1;
  if (spk.status !== 'QUEUED' && mulai === 0) {
    throw new Error(`majukanSampai: ${spk.status} tidak ada di jalur menuju ${tujuan}`);
  }
  let hasil: any = spk;
  for (const status of jalur.slice(mulai)) {
    hasil = await ubahStatus(token, spk.number, status);
  }
  return hasil;
}

export async function batalkanSpk(token: string, nomor: string, reason = 'Pelanggan memutuskan servis di lain hari.'): Promise<any> {
  return wajib(await api.post(`/api/work-orders/${nomor}/cancel`, { token, json: { reason } }), 200).body.data;
}

export async function bayar(token: string, nomor: string, amount: number, method = 'cash'): Promise<any> {
  return wajib(await api.post(`/api/work-orders/${nomor}/payments`, { token, json: { amount, method } }), 201).body.data;
}

// Membayar seluruh sisa tagihan. SPK yang sudah lunas dikembalikan apa adanya
// (pembayaran 0 ditolak spec).
export async function lunasi(token: string, spk: { number: string; total: number; paidAmount: number }, method = 'cash'): Promise<any> {
  return spk.total === spk.paidAmount ? spk : bayar(token, spk.number, spk.total - spk.paidAmount, method);
}

// Kirim ulang WhatsApp yang berhasil (200). Untuk menguji 503 pakai api.post.
export async function kirimWa(token: string, nomor: string, type: string, phone?: string): Promise<any> {
  return wajib(await api.post(`/api/work-orders/${nomor}/wa`, { token, json: phone === undefined ? { type } : { type, phone } }), 200).body.data;
}

export async function buatUlangTautan(token: string, nomor: string): Promise<any> {
  return wajib(await api.post(`/api/work-orders/${nomor}/tracking-link`, { token }), 200).body.data;
}

export async function lacakPublik(trackingToken: string): Promise<any> {
  return wajib(await api.get(`/api/public/work-orders/${trackingToken}`), 200).body.data;
}

// --- Bengkel siap pakai ------------------------------------------------------

export interface Bengkel {
  pemilik: SesiStaf;
  kasir: SesiStaf;
  mekanik: SesiStaf;
  // Jasa publik "Ganti Oli" Rp35.000.
  gantiOli: any;
  // Jasa nonpublik "Cek Kelistrikan" Rp50.000.
  cekKelistrikan: any;
  // Sparepart "Oli Mesin 10W-40 0,8 L": jual Rp55.000, beli Rp40.000, stok 20 botol.
  oli: any;
  // Sparepart "Kampas Rem Depan Vario": jual Rp75.000, beli Rp50.000, stok 10 set.
  kampas: any;
  // Pelanggan "Budi Santoso" (nomor unik) dengan satu motor Honda Vario 125.
  pelanggan: any;
  kendaraan: any;
}

// Pemilik, kasir, mekanik, dua jasa, dua sparepart, dan satu pelanggan dengan
// satu kendaraan. Nama dan harga mengikuti contoh di spec/whatsapp.md.
export async function siapkanBengkel(): Promise<Bengkel> {
  const pemilik = await buatPemilik();
  const kasir = await buatKasir();
  const mekanik = await buatMekanik();
  const gantiOli = await buatJasa(pemilik.token, { name: namaUnik('Ganti Oli'), price: 35000, durationMinutes: 30 });
  const cekKelistrikan = await buatJasaNonPublik(pemilik.token, { name: namaUnik('Cek Kelistrikan'), price: 50000 });
  const oli = await buatPart(pemilik.token, { name: 'Oli Mesin 10W-40 0,8 L', unit: 'botol', price: 55000, costPrice: 40000, initialStock: 20 });
  const kampas = await buatPart(pemilik.token, { name: 'Kampas Rem Depan Vario', unit: 'set', price: 75000, costPrice: 50000, initialStock: 10 });
  const { pelanggan, kendaraan } = await buatPelangganDenganKendaraan(kasir.token);
  return { pemilik, kasir, mekanik, gantiOli, cekKelistrikan, oli, kampas, pelanggan, kendaraan };
}

// SPK baru untuk kendaraan bengkel, dibuat kasir.
export const spkBengkel = (b: Bengkel, ubah: Record<string, unknown> = {}) => buatSpk(b.kasir.token, b.kendaraan.vehicleId, ubah);

// SPK berisi Ganti Oli (Rp35.000) dan satu Oli (Rp55.000) = Rp90.000, opsional
// ditugaskan ke mekanik bengkel.
export async function spkBerisi(b: Bengkel, opsi: { denganMekanik?: boolean } = {}): Promise<any> {
  const spk = await spkBengkel(b, opsi.denganMekanik ? { mechanicId: b.mekanik.staff.staffId } : {});
  await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId);
  return tambahPart(b.kasir.token, spk.number, b.oli.partId);
}

export function detikDari(teksWaktu: string, acuan: Date = new Date()): number {
  return (new Date(teksWaktu).getTime() - acuan.getTime()) / 1000;
}
