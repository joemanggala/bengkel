// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pembantu khusus tes area SPK (spk-baru, daftar-spk, ubah-spk, status-spk,
// item-spk, batal-spk). Pemanggil rute di sini mengembalikan Respons apa
// adanya (tidak melempar) supaya tes bisa memeriksa galatnya; pembuat data
// tetap memakai src/data.ts yang melempar.

import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { batalkanSpk, buatSpk, lunasi, tambahJasa, ubahStatus, type Bengkel, type SesiStaf } from '../src/data';
import { baca, barisPart, barisSpk, idSpk, jalankan, jumlahBaris, type BarisKartuStok } from '../src/db';
import { api, ringkas, type Respons } from '../src/klien';

export type StatusSpk = 'QUEUED' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'DONE' | 'PICKED_UP' | 'CANCELLED';

export const SEMUA_STATUS: StatusSpk[] = ['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP', 'CANCELLED'];

// UUID kanonik huruf kecil yang tidak pernah ada di database.
export const uuidAcak = (): string => randomUUID();

// StafRingkas dari sesi staf (by, createdBy, mechanic, recordedBy).
export function ringkasStaf(sesi: SesiStaf): { staffId: string; name: string } {
  return { staffId: sesi.staff.staffId, name: sesi.staff.name };
}

// --- Pemanggil rute (tidak melempar) ------------------------------------------

export const kirimBuat = (token: string, json: unknown): Promise<Respons> => api.post('/api/work-orders', { token, json });

export const ambilSpk = (token: string, nomor: string): Promise<Respons> => api.get(`/api/work-orders/${nomor}`, { token });

export const kirimUbah = (token: string, nomor: string, json: unknown): Promise<Respons> =>
  api.patch(`/api/work-orders/${nomor}`, { token, json });

export const kirimStatus = (token: string, nomor: string, json: unknown): Promise<Respons> =>
  api.post(`/api/work-orders/${nomor}/status`, { token, json });

export const kirimBatal = (token: string, nomor: string, json: unknown): Promise<Respons> =>
  api.post(`/api/work-orders/${nomor}/cancel`, { token, json });

export const kirimItem = (token: string, nomor: string, json: unknown): Promise<Respons> =>
  api.post(`/api/work-orders/${nomor}/items`, { token, json });

export const kirimHapus = (token: string, nomor: string, itemId: string): Promise<Respons> =>
  api.delete(`/api/work-orders/${nomor}/items/${itemId}`, { token });

export const daftarSpk = (token: string, query: Record<string, string | number | undefined> = {}): Promise<Respons> =>
  api.get('/api/work-orders', { token, query });

// Nomor SPK di satu halaman daftar, sesuai urutan balasan.
export async function nomorDaftar(token: string, query: Record<string, string | number | undefined> = {}): Promise<string[]> {
  const res = await daftarSpk(token, query);
  expect(res.status, ringkas(res)).toBe(200);
  return res.body.data.map((s: any) => s.number);
}

// --- SPK di status tertentu ---------------------------------------------------

export interface OpsiSpkDiStatus {
  // Mekanik yang ditugaskan saat SPK dibuat (bawaan: tanpa mekanik).
  mekanik?: SesiStaf | undefined;
  // Bawaan true: satu item jasa Ganti Oli (Rp35.000) supaya DONE sah. Item
  // jasa tidak menyentuh stok.
  item?: boolean;
  // Field tambahan untuk POST /api/work-orders.
  ubah?: Record<string, unknown>;
}

// SPK baru (dibuat kasir bengkel) yang dibawa lewat jalur sah ke `status`.
// PICKED_UP dilunasi dulu; CANCELLED dibatalkan dari QUEUED.
export async function spkDiStatus(b: Bengkel, status: StatusSpk, opsi: OpsiSpkDiStatus = {}): Promise<any> {
  const token = b.kasir.token;
  let spk = await buatSpk(token, b.kendaraan.vehicleId, {
    ...(opsi.mekanik ? { mechanicId: opsi.mekanik.staff.staffId } : {}),
    ...opsi.ubah,
  });
  if (opsi.item ?? true) {
    spk = await tambahJasa(token, spk.number, b.gantiOli.serviceId);
  }
  const langkah: Record<StatusSpk, string[]> = {
    QUEUED: [],
    CANCELLED: [],
    IN_PROGRESS: ['IN_PROGRESS'],
    WAITING_PARTS: ['IN_PROGRESS', 'WAITING_PARTS'],
    DONE: ['IN_PROGRESS', 'DONE'],
    PICKED_UP: ['IN_PROGRESS', 'DONE'],
  };
  for (const s of langkah[status]) {
    spk = await ubahStatus(token, spk.number, s);
  }
  if (status === 'PICKED_UP') {
    await lunasi(token, spk);
    spk = await ubahStatus(token, spk.number, 'PICKED_UP');
  }
  if (status === 'CANCELLED') {
    spk = await batalkanSpk(token, spk.number);
  }
  return spk;
}

// --- Database -------------------------------------------------------------------

export async function statusDb(nomor: string): Promise<string> {
  return (await barisSpk(nomor)).status;
}

export async function jumlahLog(nomor: string): Promise<number> {
  return jumlahBaris('work_order_status_logs', 'work_order_id = ?', [await idSpk(nomor)]);
}

export async function jumlahWaSpk(nomor: string): Promise<number> {
  return jumlahBaris('wa_messages', 'work_order_id = ?', [await idSpk(nomor)]);
}

export async function stokDb(partId: string): Promise<number> {
  return (await barisPart(partId)).stock;
}

// Kartu stok sebuah sparepart yang disebabkan satu SPK, dari yang terlama.
export async function kartuSpk(partId: string, nomor: string): Promise<BarisKartuStok[]> {
  const baris = await baca<BarisKartuStok>(
    'SELECT stock_movement_id, type, quantity, stock_after, note, work_order_id, staff_id, created_at FROM stock_movements ' +
      'WHERE part_id = ? AND work_order_id = ? ORDER BY created_at, stock_movement_id',
    [partId, await idSpk(nomor)],
  );
  return baris.map((k) => ({ ...k, quantity: Number(k.quantity), stock_after: Number(k.stock_after) }));
}

// Waktu lampau yang pasti lebih tua dari perubahan apa pun selama tes.
export const WAKTU_LAMA = '2001-01-01T00:00:00.000Z';

// Memundurkan updated_at SPK supaya tes bisa membuktikan bahwa sebuah
// perubahan memperbaruinya, tanpa bergantung pada selisih milidetik.
export async function mundurkanUpdatedAt(nomor: string): Promise<void> {
  const jumlah = await jalankan("UPDATE work_orders SET updated_at = '2001-01-01 00:00:00.000' WHERE number = ?", [nomor]);
  if (jumlah !== 1) {
    throw new Error(`SPK ${nomor} tidak ditemukan untuk dimundurkan updated_at-nya`);
  }
}

export function sesudahWaktuLama(teksWaktu: string): boolean {
  return Date.parse(teksWaktu) > Date.parse(WAKTU_LAMA);
}

// Harga beli tidak pernah ada di respons SPK untuk siapa pun. Skema ItemSpk
// sudah tertutup; pemeriksaan teks ini membuat aturannya terbaca di tes.
export function harapTanpaHargaBeli(res: Respons): void {
  expect(res.teks, ringkas(res)).not.toMatch(/costPrice|cost_price/);
  for (const item of res.body?.data?.items ?? []) {
    expect('costPrice' in item).toBe(false);
  }
}

// Kartu stok satu sparepart lewat API pemilik (terbaru dulu, satu halaman 50).
export async function pergerakanApi(tokenPemilik: string, partId: string): Promise<any[]> {
  const res = await api.get(`/api/parts/${partId}/movements`, { token: tokenPemilik, query: { limit: 50 } });
  expect(res.status, ringkas(res)).toBe(200);
  return res.body.data;
}
