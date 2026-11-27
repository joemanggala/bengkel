// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pembantu khusus tes area fondasi dan staf (kesehatan, setup, staf-auth,
// kelola-staf, outlet, matriks-peran). Isinya hal-hal yang `api` di src/klien.ts
// sengaja tidak lakukan: membaca header balasan untuk rute di luar spec,
// mengirim badan yang rusak atau terlalu besar, dan mengubah token.

import { randomBytes } from 'node:crypto';
import { bacaEnv } from '../src/env';
import { USER_AGENT_UJI } from '../src/klien';

export const SATU_MIB = 1024 * 1024;
export const SEHARI = 24 * 60 * 60;

// Badan yang rusak sebagai JSON. Dipakai untuk membuktikan 400 datang lebih
// dulu daripada 401, 403, 404, dan 422.
export const JSON_RUSAK = '{"rusak":';

// JSON yang sah tetapi lebih dari 1 MiB (batas badan rute staf dan setup).
export function jsonLebihDariSatuMib(): string {
  return JSON.stringify({ catatan: 'a'.repeat(SATU_MIB + 16) });
}

// Badan JSON yang memuat byte 0xFF (bukan UTF-8 sah). Spec menyamakannya
// dengan JSON rusak: 400, diperiksa sebelum token.
export function badanUtf8Rusak(): { isi: Uint8Array; jenis: string } {
  const awal = new TextEncoder().encode('{"name":"bu');
  const akhir = new TextEncoder().encode('di"}');
  return { isi: new Uint8Array([...awal, 0xff, ...akhir]), jenis: 'application/json' };
}

// Token yang bentuknya sah (43 karakter base64url) tetapi tidak pernah
// diterbitkan, jadi lolos pemeriksaan bentuk dan harus ditolak setelah dicari.
export function tokenAcak(): string {
  return randomBytes(32).toString('base64url');
}

// Menukar huruf besar dan kecil pada token. Token peka huruf besar/kecil,
// jadi hasilnya tidak boleh diterima. Mengembalikan undefined bila tidak ada
// huruf yang berubah (token yang semuanya angka dan tanda), supaya tes bisa
// melewatinya daripada membuktikan hal yang salah.
export function tukarHuruf(token: string): string | undefined {
  const hasil = [...token].map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join('');
  return hasil === token ? undefined : hasil;
}

export interface BalasanLangsung {
  status: number;
  header: Headers;
  teks: string;
  // Hasil urai JSON; undefined bila badan kosong atau bukan JSON.
  body: any;
}

// Permintaan tanpa validasi spec dan tanpa mengikuti pengalihan, untuk rute
// dan metode yang memang tidak ada di spec (404) beserta header balasannya.
// `redirect: 'manual'` supaya backend yang mengalihkan path ber-"//" atau
// ber-garis-miring tampil sebagai 301/308 yang jelas salah, bukan 200 samar.
export async function mintaLangsung(
  metode: string,
  path: string,
  opsi: { header?: Record<string, string>; badan?: string; jenis?: string } = {},
): Promise<BalasanLangsung> {
  const header: Record<string, string> = { 'User-Agent': USER_AGENT_UJI, Accept: '*/*', ...opsi.header };
  if (opsi.badan !== undefined) {
    header['Content-Type'] = opsi.jenis ?? 'application/json';
  }
  const balasan = await fetch(`${bacaEnv().baseUrl}${path}`, {
    method: metode,
    headers: header,
    body: opsi.badan,
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
  const teks = await balasan.text();
  let body: any;
  try {
    body = JSON.parse(teks);
  } catch {
    body = undefined;
  }
  return { status: balasan.status, header: balasan.headers, teks, body };
}

// Memeriksa balasan 404 not_found dari rute yang tidak dikenal: bentuk galat
// JSON dengan pesan. Pesannya boleh spesifik (tidak ada pesan baku untuk
// not_found), jadi hanya jenisnya yang diperiksa.
export function bentukNotFound(res: BalasanLangsung): { status: number; code: unknown; jenisIsi: string; pesanTeks: boolean } {
  return {
    status: res.status,
    code: res.body?.error?.code,
    jenisIsi: (res.header.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '',
    pesanTeks: typeof res.body?.error?.message === 'string' && res.body.error.message.length > 0,
  };
}

export const NOT_FOUND_JSON = { status: 404, code: 'not_found', jenisIsi: 'application/json', pesanTeks: true };
