// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pembantu tes sparepart, kartu stok, dan pencatatan stok (sparepart, sparepart-daftar, stok,
// stok-kartu). Isinya pembungkus rute dengan token eksplisit (null = tanpa token), pembuat keadaan
// yang melempar bila gagal, dan pembaca keadaan stok dari database sebagai bukti yang tidak
// bergantung pada API. Aturan bisnis (kapan stok berubah, pesan galat) sengaja tidak ditulis ulang
// di sini: tiap tes menyebut angka yang diharapkannya sendiri.

import { wajib, type SesiStaf } from '../src/data';
import { barisKartuStok, barisPart, jalankan, jumlahBaris, teksUtc } from '../src/db';
import { api, type Respons } from '../src/klien';
import { denganQuery, type Query } from './pembantu-pelanggan';

// --- Pembungkus rute --------------------------------------------------------

export function kirimBuatPart(token: string | null, json: unknown): Promise<Respons> {
  return api.post('/api/parts', { token, json });
}

// `query` berupa objek, atau teks query mentah tanpa "?" untuk nilai yang dikirim apa adanya.
export function kirimDaftarPart(token: string | null, query: Query | string = {}): Promise<Respons> {
  return typeof query === 'string' ? api.get(denganQuery('/api/parts', query), { token }) : api.get('/api/parts', { token, query });
}

export function kirimUbahPart(token: string | null, partId: string, json: unknown): Promise<Respons> {
  return api.patch(`/api/parts/${partId}`, { token, json });
}

export function kirimKartu(token: string | null, partId: string, query: Query | string = {}): Promise<Respons> {
  const path = `/api/parts/${partId}/movements`;
  return typeof query === 'string' ? api.get(denganQuery(path, query), { token }) : api.get(path, { token, query });
}

export function kirimStokMasuk(token: string | null, partId: string, json: unknown): Promise<Respons> {
  return api.post(`/api/parts/${partId}/stock-in`, { token, json });
}

export function kirimStokKeluar(token: string | null, partId: string, json: unknown): Promise<Respons> {
  return api.post(`/api/parts/${partId}/stock-out`, { token, json });
}

export function kirimHitungStok(token: string | null, partId: string, json: unknown): Promise<Respons> {
  return api.post(`/api/parts/${partId}/stock-count`, { token, json });
}

// --- Pembuat keadaan --------------------------------------------------------

export async function ubahPart(token: string, partId: string, json: Record<string, unknown>): Promise<any> {
  return wajib(await kirimUbahPart(token, partId, json), 200).body.data;
}

// Sparepart dari daftar (bentuk sesuai peran peminta), dicari lewat SKU-nya.
export async function ambilPart(token: string, part: { sku: string; partId: string }): Promise<any> {
  const res = wajib(await kirimDaftarPart(token, { search: part.sku, limit: 50 }), 200);
  const baris = res.body.data.find((x: any) => x.partId === part.partId);
  if (!baris) {
    throw new Error(`Sparepart ${part.sku} tidak ada di daftar`);
  }
  return baris;
}

// Seluruh kartu stok satu sparepart lewat API (paling banyak 50 baris), terbaru dulu.
export async function kartuApi(tokenPemilik: string, partId: string): Promise<any[]> {
  return wajib(await kirimKartu(tokenPemilik, partId, { limit: 50 }), 200).body.data;
}

// Bentuk StafRingkas dari sesi staf.
export function ringkasStaf(sesi: SesiStaf): { staffId: string; name: string } {
  return { staffId: sesi.staff.staffId, name: sesi.staff.name };
}

// Sparepart tanpa updatedAt (spec tidak menyebut apakah updatedAt bergeser pada PATCH {} atau
// pencatatan stok).
export function tanpaWaktuPart<T extends object>(part: T): Omit<T, 'updatedAt'> {
  const { updatedAt: _abaikan, ...sisa } = part as T & { updatedAt?: unknown };
  return sisa;
}

// Bentuk SparepartStaf yang diharapkan dari SparepartPemilik: sama persis tanpa kunci costPrice.
export function tanpaHargaBeli<T extends object>(part: T): Omit<T, 'costPrice'> {
  const { costPrice: _abaikan, ...sisa } = part as T & { costPrice?: unknown };
  return sisa;
}

// --- Keadaan stok dari database --------------------------------------------

export interface PotretStok {
  stock: number;
  costPrice: number;
  barisKartu: number;
}

// Stok, harga beli, dan jumlah baris kartu stok satu sparepart: bukti bahwa permintaan yang ditolak
// tidak mengubah apa pun.
export async function potretStok(partId: string): Promise<PotretStok> {
  const p = await barisPart(partId);
  return { stock: p.stock, costPrice: p.cost_price, barisKartu: await jumlahBaris('stock_movements', 'part_id = ?', [partId]) };
}

// Menetapkan created_at baris kartu stok (urutan kartu stok tidak boleh bergantung pada kecepatan
// backend menulis waktu).
export async function aturWaktuKartu(movementId: string, waktuUtc: string | Date): Promise<void> {
  const jumlah = await jalankan('UPDATE stock_movements SET created_at = ? WHERE stock_movement_id = ?', [teksUtc(waktuUtc), movementId]);
  if (jumlah !== 1) {
    throw new Error(`Kartu stok ${movementId} tidak ditemukan untuk diatur waktunya`);
  }
}

// Baris kartu stok di database (terlama dulu) yang memenuhi `cocok`; melempar bila tidak tepat satu.
export async function satuKartuDb(partId: string, cocok: (k: { type: string; note: string; quantity: number }) => boolean): Promise<string> {
  const ketemu = (await barisKartuStok(partId)).filter(cocok);
  if (ketemu.length !== 1 || !ketemu[0]) {
    throw new Error(`Baris kartu stok yang dicari seharusnya tepat satu, ternyata ${ketemu.length}`);
  }
  return ketemu[0].stock_movement_id;
}
