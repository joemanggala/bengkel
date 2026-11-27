// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pembantu khusus tes uang, WhatsApp, halaman lacak, matriks peran, rekap, dan
// permintaan serentak (pembayaran, kirim-wa, wa-otomatis, publik-lacak,
// matriks-peran, rekap, serentak). Seperti src/data.ts, pembuat data di sini
// melempar (bukan expect) bila backend membalas di luar yang diharapkan.

import {
  batalkanSpk,
  buatPelangganDenganKendaraan,
  buatSpk,
  lunasi,
  majukanSampai,
  tambahJasa,
  tambahPart,
  ubahStatus,
  wajib,
  type Bengkel,
  type SesiStaf,
} from '../src/data';
import { bacaSatu } from '../src/db';
import { bacaEnv } from '../src/env';
import { tautanLacak } from '../src/format';
import { api, type Respons } from '../src/klien';
import { muatSpec } from '../src/spec';

export const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Total SPK dari spkBerisi / isiSpk: Ganti Oli Rp35.000 + satu Oli Rp55.000.
export const TOTAL_BERISI = 90_000;

export type StatusSpk = 'QUEUED' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'DONE' | 'PICKED_UP' | 'CANCELLED';
export const SEMUA_STATUS: readonly StatusSpk[] = ['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP', 'CANCELLED'];

// StafRingkas seorang staf, seperti di recordedBy, createdBy, dan mechanic.
export function ringkasStaf(s: SesiStaf): { staffId: string; name: string } {
  return { staffId: s.staff.staffId, name: s.staff.name };
}

// Permintaan mentah (tanpa melempar), untuk menguji balasan galat.
export function kirimBayar(token: string | undefined, nomor: string, json: unknown): Promise<Respons> {
  return api.post(`/api/work-orders/${nomor}/payments`, { token, json });
}

export function kirimWaSpk(token: string | undefined, nomor: string, json: unknown): Promise<Respons> {
  return api.post(`/api/work-orders/${nomor}/wa`, { token, json });
}

// Uang SPK menurut database: paid_amount, jumlah semua baris payments, dan
// banyaknya baris. Ketiganya harus selalu cocok satu sama lain.
export async function ringkasUangDb(nomor: string): Promise<{ paid: number; jumlah: number; baris: number }> {
  const b = await bacaSatu<{ paid: number; jumlah: number | null; baris: number }>(
    'SELECT w.paid_amount AS paid, (SELECT SUM(p.amount) FROM payments p WHERE p.work_order_id = w.work_order_id) AS jumlah, ' +
      '(SELECT COUNT(*) FROM payments p WHERE p.work_order_id = w.work_order_id) AS baris FROM work_orders w WHERE w.number = ?',
    [nomor],
  );
  if (!b) {
    throw new Error(`SPK ${nomor} tidak ada di database`);
  }
  return { paid: Number(b.paid), jumlah: Number(b.jumlah ?? 0), baris: Number(b.baris) };
}

// Profil outlet saat ini (bentuk Outlet), sumber nilai pesan WhatsApp.
export async function profilOutlet(): Promise<any> {
  return wajib(await api.get('/api/outlet'), 200).body.data;
}

// {tautanLacak} untuk SPK (SpkDetail) memakai PUBLIC_WEB_URL harness.
export function tautanSpk(spk: { trackingToken: string }): string {
  return tautanLacak(bacaEnv().publicWebUrl, spk.trackingToken);
}

let urutanNomor = 0;

// Nomor HP seragam 628… dengan panjang total `digit` (10..15) yang tidak
// pernah sama di satu proses tes. Dipakai untuk penyamaran nomor pendek dan
// panjang di halaman publik.
export function nomorPanjang(digit: number): string {
  if (digit < 10 || digit > 15) {
    throw new Error('Nomor HP seragam 10..15 digit');
  }
  urutanNomor += 1;
  const sisa = digit - 3;
  const angka = String(Date.now() * 1000 + urutanNomor).slice(-sisa).padStart(sisa, '0');
  return `628${angka}`;
}

// Bentuk 08… dari nomor seragam 628….
export function nomorLokal(seragam: string): string {
  return `0${seragam.slice(2)}`;
}

// Mengisi SPK dengan Ganti Oli (Rp35.000) dan satu Oli (Rp55.000) = Rp90.000.
export async function isiSpk(b: Bengkel, nomor: string): Promise<any> {
  await tambahJasa(b.kasir.token, nomor, b.gantiOli.serviceId);
  return tambahPart(b.kasir.token, nomor, b.oli.partId);
}

export interface SpkBernomor {
  // Nomor HP seragam pelanggan SPK ini; tidak dipakai SPK lain, jadi semua
  // pesan di WhatsApp palsu untuk nomor ini milik SPK ini.
  nomorHp: string;
  pelanggan: any;
  kendaraan: any;
  spk: any;
}

// SPK untuk pelanggan baru (nomor dan plat unik), dibuat kasir. `isi`
// menambahkan Ganti Oli + Oli (Rp90.000). Pesan work_order_created otomatis
// sudah dikirim ke nomor itu saat SPK dibuat.
export async function spkPelangganBaru(
  b: Bengkel,
  opsi: { isi?: boolean; ubahPelanggan?: Record<string, unknown>; ubahKendaraan?: Record<string, unknown>; ubahSpk?: Record<string, unknown> } = {},
): Promise<SpkBernomor> {
  const { pelanggan, kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token, opsi.ubahPelanggan, opsi.ubahKendaraan);
  let spk = await buatSpk(b.kasir.token, kendaraan.vehicleId, opsi.ubahSpk);
  if (opsi.isi) {
    spk = await isiSpk(b, spk.number);
  }
  return { nomorHp: pelanggan.phone, pelanggan, kendaraan, spk };
}

// Membawa SPK (yang sudah berisi item bila tujuannya DONE atau PICKED_UP) dari
// QUEUED ke `tujuan`. PICKED_UP dilunasi lebih dulu; CANCELLED dibatalkan
// langsung dari QUEUED. Mengembalikan rincian sesudahnya.
export async function keStatus(b: Bengkel, spk: any, tujuan: StatusSpk): Promise<any> {
  if (tujuan === 'CANCELLED') {
    return batalkanSpk(b.kasir.token, spk.number);
  }
  if (tujuan !== 'PICKED_UP') {
    return majukanSampai(b.kasir.token, spk, tujuan);
  }
  const selesai = await majukanSampai(b.kasir.token, spk, 'DONE');
  await lunasi(b.kasir.token, selesai);
  return ubahStatus(b.kasir.token, spk.number, 'PICKED_UP');
}

// Pembayaran yang baru muncul di rincian sesudah dibandingkan rincian sebelum.
export function pembayaranBaru(sebelum: { payments: any[] }, sesudah: { payments: any[] }): any {
  const lama = new Set(sebelum.payments.map((p) => p.paymentId));
  const baru = sesudah.payments.filter((p) => !lama.has(p.paymentId));
  if (baru.length !== 1) {
    throw new Error(`Diharapkan tepat satu pembayaran baru, dapat ${baru.length}`);
  }
  return baru[0];
}

// Selisih waktu teks API dari jam mesin tes, dalam milidetik (mutlak).
export function selisihSekarangMs(teksWaktu: string): number {
  return Math.abs(Date.parse(teksWaktu) - Date.now());
}

// Semua nama kunci di objek bersarang (untuk membuktikan respons publik tidak
// memuat kunci tertentu di tingkat mana pun).
export function semuaKunci(nilai: unknown, hasil: Set<string> = new Set()): Set<string> {
  if (Array.isArray(nilai)) {
    for (const v of nilai) {
      semuaKunci(v, hasil);
    }
  } else if (nilai && typeof nilai === 'object') {
    for (const [k, v] of Object.entries(nilai)) {
      hasil.add(k);
      semuaKunci(v, hasil);
    }
  }
  return hasil;
}

// Semua operasi di spec sebagai "METODE /template", dipisah menjadi rute
// publik (security: []) dan rute staf (tokenStaf). Dipakai matriks peran untuk
// membuktikan tabelnya mencakup ke-52 operasi.
export function operasiSpec(): { staf: string[]; publik: string[] } {
  const staf: string[] = [];
  const publik: string[] = [];
  for (const [template, item] of Object.entries(muatSpec().paths as Record<string, Record<string, any>>)) {
    for (const metode of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = item[metode];
      if (op) {
        const nama = `${metode.toUpperCase()} ${template}`;
        (Array.isArray(op.security) && op.security.length === 0 ? publik : staf).push(nama);
      }
    }
  }
  return { staf: staf.sort(), publik: publik.sort() };
}

// n salinan nilai (untuk menyusun harapan hasil serentak).
export function ulang<T>(n: number, nilai: T): T[] {
  return Array.from({ length: n }, () => nilai);
}

// "201", "409:kode", dst., diurutkan, supaya hasil serentak dibandingkan
// sebagai himpunan (urutan tiba permintaan tidak menentukan).
export function ringkasHasil(semua: Respons[]): string[] {
  return semua.map((r) => (r.status >= 400 ? `${r.status}:${r.body?.error?.code}` : String(r.status))).sort();
}
