// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { peranToken, type PeranStaf } from './db';
import { bacaEnv } from './env';
import { cariOperasi, skemaKomponen, uraiGalatAjv, validatorSkema } from './spec';

export const USER_AGENT_UJI = 'bengkel-tes-kontrak/1.0';

export interface OpsiMinta {
  token?: string | null | undefined;
  header?: Record<string, string>;
  json?: unknown;
  // Badan mentah dengan Content-Type application/json, untuk menguji JSON rusak.
  mentah?: string;
  // Badan biner apa adanya beserta Content-Type-nya, mis. JSON dengan byte
  // UTF-8 yang tidak sah.
  biner?: { isi: Uint8Array; jenis: string };
  query?: Record<string, string | number | boolean | undefined>;
}

export interface Respons {
  status: number;
  header: Headers;
  // Hasil urai JSON; undefined bila badan kosong atau bukan JSON.
  body: any;
  // Badan sebagai teks UTF-8.
  teks: string;
  metode: string;
  path: string;
  // Peran pemilik token saat permintaan dikirim, bila validator respons
  // membutuhkannya (daftar sparepart). undefined untuk rute lain.
  peran?: PeranStaf | undefined;
}

export class GalatKontrak extends Error {}

function ringkasBadan(teks: string): string {
  return teks.length > 600 ? `${teks.slice(0, 600)}…` : teks;
}

export function ringkas(res: Pick<Respons, 'metode' | 'path' | 'status' | 'teks'>): string {
  return `${res.metode} ${res.path} → ${res.status} ${ringkasBadan(res.teks)}`;
}

function susunPath(path: string, query?: OpsiMinta['query']): string {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams();
  for (const [nama, nilai] of Object.entries(query)) {
    if (nilai !== undefined) {
      params.set(nama, String(nilai));
    }
  }
  const teks = params.toString();
  return teks ? `${path}${path.includes('?') ? '&' : '?'}${teks}` : path;
}

// Rute yang bentuk barisnya bergantung pada peran peminta. Skema spec untuk
// daftar sparepart berupa oneOf pemilik/kasir, jadi oneOf saja meloloskan
// kasir yang menerima `costPrice` (cocok dengan bentuk pemilik). Spec
// menyatakan "pemeriksa kontrak menilai tiap baris dengan skema milik peran
// peminta": itulah yang dilakukan di sini, di samping validasi oneOf.
const SKEMA_BARIS_PER_PERAN: Record<string, { owner: string; lain: string }> = {
  'GET /api/parts 200': { owner: 'SparepartPemilik', lain: 'SparepartStaf' },
};

function butuhPeran(metode: string, path: string): boolean {
  const operasi = cariOperasi(metode, path);
  return operasi !== undefined && Object.keys(SKEMA_BARIS_PER_PERAN).some((k) => k.startsWith(`${metode} ${operasi.template} `));
}

function validasiPerPeran(res: Respons, template: string): void {
  const aturan = SKEMA_BARIS_PER_PERAN[`${res.metode} ${template} ${res.status}`];
  if (!aturan) {
    return;
  }
  if (!res.peran) {
    throw new GalatKontrak(
      `${res.metode} ${template} membalas ${res.status}, tetapi token peminta tidak dikenal di database (peran tidak bisa ditentukan)`,
    );
  }
  const nama = res.peran === 'owner' ? aturan.owner : aturan.lain;
  const v = validatorSkema(`komponen ${nama}`, skemaKomponen(nama));
  const baris = Array.isArray(res.body?.data) ? (res.body.data as unknown[]) : [];
  for (const [i, isi] of baris.entries()) {
    if (!v(isi)) {
      throw new GalatKontrak(
        `Baris data.${i} ${res.metode} ${template} untuk peran ${res.peran} harus berbentuk ${nama}:\n  ${uraiGalatAjv(v)}\nBadan: ${ringkasBadan(res.teks)}`,
      );
    }
  }
}

// Setiap respons dicocokkan dengan operasi di spec berdasarkan path, metode,
// dan kode status. Kode status yang tidak tertulis, media type yang berbeda,
// atau badan yang tidak cocok dengan skema langsung menggagalkan tes. Skema
// respons di spec sudah tertutup (additionalProperties: false) dan divalidasi
// apa adanya dengan Ajv, tanpa aturan tambahan Redocly.
export function validasi(res: Respons): void {
  const operasi = cariOperasi(res.metode, res.path);
  if (!operasi) {
    throw new GalatKontrak(`Rute ${res.metode} ${res.path} tidak ada di spec`);
  }
  const responsSpec = operasi.op.responses?.[String(res.status)];
  if (!responsSpec) {
    throw new GalatKontrak(
      `Kode status ${res.status} tidak tertulis di spec untuk ${res.metode} ${operasi.template}.\nBadan: ${ringkasBadan(res.teks)}`,
    );
  }
  for (const [nama, h] of Object.entries((responsSpec.headers ?? {}) as Record<string, any>)) {
    if (h.required && !res.header.has(nama)) {
      throw new GalatKontrak(`Header ${nama} wajib ada pada ${res.status} ${res.metode} ${operasi.template}`);
    }
  }
  const konten = responsSpec.content as Record<string, any> | undefined;
  if (!konten) {
    if (res.teks.length > 0) {
      throw new GalatKontrak(`${res.status} ${res.metode} ${operasi.template} harus tanpa badan, tetapi berisi: ${ringkasBadan(res.teks)}`);
    }
    return;
  }
  const jenis = (res.header.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  const media = konten[jenis];
  if (!media) {
    throw new GalatKontrak(
      `Content-Type "${jenis}" tidak tertulis untuk ${res.status} ${res.metode} ${operasi.template} (harus: ${Object.keys(konten).join(', ')})`,
    );
  }
  if (res.body === undefined) {
    throw new GalatKontrak(`Badan ${res.status} ${res.metode} ${operasi.template} bukan JSON: ${ringkasBadan(res.teks)}`);
  }
  const v = validatorSkema(`${res.metode} ${operasi.template} ${res.status}`, media.schema ?? {});
  if (!v(res.body)) {
    throw new GalatKontrak(
      `Badan ${res.status} ${res.metode} ${operasi.template} tidak sesuai spec:\n  ${uraiGalatAjv(v)}\nBadan: ${ringkasBadan(res.teks)}`,
    );
  }
  validasiPerPeran(res, operasi.template);
}

export async function minta(metode: string, path: string, opsi: OpsiMinta = {}): Promise<Respons> {
  const { baseUrl } = bacaEnv();
  // Accept netral seperti browser: galat tetap wajib berupa JSON walau klien
  // tidak memintanya secara khusus.
  const header: Record<string, string> = { 'User-Agent': USER_AGENT_UJI, Accept: '*/*', ...opsi.header };
  if (opsi.token) {
    header.Authorization = `Bearer ${opsi.token}`;
  }
  let badan: string | Uint8Array<ArrayBuffer> | undefined;
  if (opsi.json !== undefined) {
    header['Content-Type'] = 'application/json';
    badan = JSON.stringify(opsi.json);
  } else if (opsi.mentah !== undefined) {
    header['Content-Type'] = 'application/json';
    badan = opsi.mentah;
  } else if (opsi.biner) {
    header['Content-Type'] = opsi.biner.jenis;
    badan = new Uint8Array(opsi.biner.isi);
  }
  const lengkap = susunPath(path, opsi.query);
  // Peran dibaca sebelum permintaan dikirim: itulah peran yang dinilai
  // backend (peran dibaca dari database pada setiap permintaan).
  const peran = opsi.token && butuhPeran(metode, lengkap) ? await peranToken(opsi.token) : undefined;
  const balasan = await fetch(`${baseUrl}${lengkap}`, {
    method: metode,
    headers: header,
    body: badan,
    redirect: 'manual',
    // WhatsApp palsu yang "putus" membuat backend menunggu sampai batas
    // waktunya (10 detik), jadi batas di sini harus lebih longgar.
    signal: AbortSignal.timeout(25_000),
  });
  const teks = await balasan.text();
  let body: any;
  if ((balasan.headers.get('content-type') ?? '').includes('json') && teks !== '') {
    try {
      body = JSON.parse(teks);
    } catch {
      body = undefined;
    }
  }
  const res: Respons = { status: balasan.status, header: balasan.headers, body, teks, metode, path: lengkap, peran };
  validasi(res);
  return res;
}

export const api = {
  get: (path: string, opsi?: OpsiMinta) => minta('GET', path, opsi),
  post: (path: string, opsi?: OpsiMinta) => minta('POST', path, opsi),
  put: (path: string, opsi?: OpsiMinta) => minta('PUT', path, opsi),
  patch: (path: string, opsi?: OpsiMinta) => minta('PATCH', path, opsi),
  delete: (path: string, opsi?: OpsiMinta) => minta('DELETE', path, opsi),
};

// Untuk membuktikan perilaku di luar rute yang tertulis (mis. rute tak
// dikenal), tanpa validasi spec.
export async function mintaMentah(
  metode: string,
  path: string,
  header: Record<string, string> = {},
): Promise<{ status: number; body: any; teks: string; header: Headers }> {
  const { baseUrl } = bacaEnv();
  const balasan = await fetch(`${baseUrl}${path}`, {
    method: metode,
    headers: { 'User-Agent': USER_AGENT_UJI, Accept: '*/*', ...header },
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
  return { status: balasan.status, body, teks, header: balasan.headers };
}
