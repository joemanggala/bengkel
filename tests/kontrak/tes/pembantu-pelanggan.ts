// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pembantu tes pelanggan dan kendaraan (pelanggan, pelanggan-daftar, kendaraan, kendaraan-cari),
// juga dipakai tes sparepart dan stok untuk hal umum (UUID tak dikenal, teks sepanjang N code
// point). Isinya pembungkus rute dengan token eksplisit (null = tanpa token) dan pembuat keadaan
// yang melempar bila gagal. Aturan bisnis sengaja tidak ditulis ulang di sini: tiap tes menyebut
// sendiri nilai yang diharapkannya, disalin dari contoh di spec.

import { nomorUnik, wajib } from '../src/data';
import { jalankan, teksUtc } from '../src/db';
import { api, type Respons } from '../src/klien';

export type Query = Record<string, string | number>;

// UUID kanonik huruf kecil yang sah tetapi tidak pernah dibuat aplikasi.
export const ID_TAK_ADA = '77777777-7777-4777-8777-777777777777';

// Id di path yang harus dianggap tidak ada (404): UUID sah yang tak dikenal, UUID yang sama dalam
// huruf besar, dan teks yang bukan UUID (lihat parameter CustomerId, VehicleId, PartId).
export function idDianggapTakAda(idAda: string): string[] {
  return [ID_TAK_ADA, idAda.toUpperCase(), 'bukan-uuid'];
}

// Urutan biner dua UUID huruf kecil (sama dengan urutan kolom CHAR(36) ascii_bin).
export function urutId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Teks dengan tepat `n` code point. Isinya emoji (dua unit UTF-16, empat byte UTF-8), supaya
// backend yang menghitung byte atau unit UTF-16, bukan code point, ketahuan.
export function teksKodePoin(n: number): string {
  return '😀'.repeat(n);
}

// Nomor HP bentuk seragam 628… dengan panjang tertentu (10–15 digit) yang tidak pernah sama di
// satu proses tes: ekor nomorUnik() dipotong atau diberi angka tambahan.
export function nomorSepanjang(panjang: number): string {
  const ekor = nomorUnik().slice(3);
  return `628${ekor.padEnd(panjang - 3, '7').slice(-(panjang - 3))}`;
}

// Bentuk ketikan "08…" dengan tanda hubung dari nomor seragam 628…: "0812-3456-7890".
export function bentukNol(seragam: string): string {
  const lokal = `0${seragam.slice(2)}`;
  return `${lokal.slice(0, 4)}-${lokal.slice(4, 8)}-${lokal.slice(8)}`;
}

// Path dengan teks query mentah; teks kosong = tanpa query sama sekali (bukan "?" kosong), supaya
// "parameter tidak dikirim" benar-benar tidak dikirim.
export function denganQuery(path: string, query: string): string {
  return query === '' ? path : `${path}?${query}`;
}

// --- Pembungkus rute --------------------------------------------------------

export function kirimBuatPelanggan(token: string | null, json: unknown): Promise<Respons> {
  return api.post('/api/customers', { token, json });
}

export function kirimDetailPelanggan(token: string | null, customerId: string): Promise<Respons> {
  return api.get(`/api/customers/${customerId}`, { token });
}

export function kirimUbahPelanggan(token: string | null, customerId: string, json: unknown): Promise<Respons> {
  return api.patch(`/api/customers/${customerId}`, { token, json });
}

// `query` berupa objek (dikodekan URLSearchParams, spasi menjadi "+") atau teks query mentah
// tanpa "?" untuk nilai yang harus dikirim apa adanya (mis. "search=%FF").
export function kirimDaftarPelanggan(token: string | null, query: Query | string = {}): Promise<Respons> {
  return typeof query === 'string' ? api.get(denganQuery('/api/customers', query), { token }) : api.get('/api/customers', { token, query });
}

export function kirimTambahKendaraan(token: string | null, customerId: string, json: unknown): Promise<Respons> {
  return api.post(`/api/customers/${customerId}/vehicles`, { token, json });
}

export function kirimUbahKendaraan(token: string | null, vehicleId: string, json: unknown): Promise<Respons> {
  return api.patch(`/api/vehicles/${vehicleId}`, { token, json });
}

export function kirimCariKendaraan(token: string | null, query: Query | string = {}): Promise<Respons> {
  return typeof query === 'string' ? api.get(denganQuery('/api/vehicles', query), { token }) : api.get('/api/vehicles', { token, query });
}

export function kirimRiwayat(token: string | null, vehicleId: string, query: Query | string = {}): Promise<Respons> {
  const path = `/api/vehicles/${vehicleId}/work-orders`;
  return typeof query === 'string' ? api.get(denganQuery(path, query), { token }) : api.get(path, { token, query });
}

// --- Pembuat keadaan --------------------------------------------------------

export async function detailPelanggan(token: string, customerId: string): Promise<any> {
  return wajib(await kirimDetailPelanggan(token, customerId), 200).body.data;
}

export async function ubahPelanggan(token: string, customerId: string, json: Record<string, unknown>): Promise<any> {
  return wajib(await kirimUbahPelanggan(token, customerId, json), 200).body.data;
}

export async function ubahKendaraan(token: string, vehicleId: string, json: Record<string, unknown>): Promise<any> {
  return wajib(await kirimUbahKendaraan(token, vehicleId, json), 200).body.data;
}

// Menetapkan created_at kendaraan (urutan kendaraan di Pelanggan tidak boleh bergantung pada
// kecepatan backend menulis waktu).
export async function aturWaktuKendaraan(vehicleId: string, waktuUtc: string | Date): Promise<void> {
  const jumlah = await jalankan('UPDATE vehicles SET created_at = ? WHERE vehicle_id = ?', [teksUtc(waktuUtc), vehicleId]);
  if (jumlah !== 1) {
    throw new Error(`Kendaraan ${vehicleId} tidak ditemukan untuk diatur waktunya`);
  }
}

// Objek tanpa updatedAt: "tanpa perubahan" di PATCH {} dinilai dari isi, bukan dari waktu ubah
// (spec tidak menyebut apakah updatedAt ikut bergeser).
export function tanpaUpdatedAt<T extends object>(x: T): Omit<T, 'updatedAt'> {
  const { updatedAt: _abaikan, ...sisa } = x as T & { updatedAt?: unknown };
  return sisa;
}

// Bentuk PelangganRingkas dari Pelanggan.
export function ringkasPelanggan(p: { customerId: string; name: string; phone: string }): { customerId: string; name: string; phone: string } {
  return { customerId: p.customerId, name: p.name, phone: p.phone };
}
