// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// GET /api/parts (semua peran staf): bentuk baris per peran (costPrice hanya untuk pemilik,
// kuncinya tidak ada sama sekali untuk kasir dan mekanik), urutan, paginasi, search (nama atau SKU),
// isActive, lowStock, dan gabungannya.
//
// Berkas ini membangun seluruh daftar sparepart di awal dan tidak mengubahnya sesudahnya. Urutan
// harapan (name naik menurut collation utf8mb4_0900_ai_ci, lalu partId naik):
//   Aki Kering 5Ah · busi iridium · Èmblem Tangki · Filter 50%_Udara · Filter 50XXUdara ·
//   Kampas Rem Depan = Kampas Rem Depan (dipisahkan partId) · Oli Mesin 0,8 L (nonaktif)

import { beforeAll, describe, expect, it } from 'vitest';
import { buatKasir, buatMekanik, buatPart, buatPemilik, type SesiStaf } from '../src/data';
import { harapGalat, harapStatus } from '../src/galat';
import { type Respons } from '../src/klien';
import { type Query, urutId } from './pembantu-pelanggan';
import { kirimDaftarPart, tanpaHargaBeli, ubahPart } from './pembantu-stok';

let pemilik: SesiStaf;
let kasir: SesiStaf;
let mekanik: SesiStaf;
const s: Record<string, any> = {};

interface Benih {
  kunci: string;
  sku: string;
  name: string;
  costPrice: number;
  initialStock: number;
  minStock: number;
  level: 'ok' | 'low' | 'out';
  nonaktif?: boolean;
}

const BENIH: Benih[] = [
  // Stok 0: habis (out), walau batasnya di atas 0.
  { kunci: 'aki', sku: 'AKI-5AH', name: 'Aki Kering 5Ah', costPrice: 300000, initialStock: 0, minStock: 2, level: 'out' },
  // Stok tepat sama dengan batas: low.
  { kunci: 'busi', sku: 'busi-ir', name: 'busi iridium', costPrice: 0, initialStock: 3, minStock: 3, level: 'low' },
  { kunci: 'emblem', sku: 'EMB-01', name: 'Èmblem Tangki', costPrice: 20000, initialStock: 10, minStock: 2, level: 'ok' },
  // % dan _ di nama: search harus mencocokkannya apa adanya, bukan sebagai wildcard.
  { kunci: 'filterP', sku: 'FLT-50P', name: 'Filter 50%_Udara', costPrice: 30000, initialStock: 4, minStock: 1, level: 'ok' },
  { kunci: 'filterX', sku: 'FLT-50X', name: 'Filter 50XXUdara', costPrice: 31000, initialStock: 4, minStock: 1, level: 'ok' },
  // Nama kembar: dipisahkan partId naik. Stok satu di atas batas: ok.
  { kunci: 'kampas1', sku: 'KR-01', name: 'Kampas Rem Depan', costPrice: 50000, initialStock: 3, minStock: 2, level: 'ok' },
  { kunci: 'kampas2', sku: 'KR-02', name: 'Kampas Rem Depan', costPrice: 50000, initialStock: 2, minStock: 2, level: 'low' },
  // Nonaktif tetap muncul di daftar (dan tetap dinilai low).
  { kunci: 'oli', sku: 'OLI-08', name: 'Oli Mesin 0,8 L', costPrice: 40000, initialStock: 1, minStock: 5, level: 'low', nonaktif: true },
];

let URUTAN: string[] = [];

beforeAll(async () => {
  pemilik = await buatPemilik();
  kasir = await buatKasir();
  mekanik = await buatMekanik();
  for (const x of BENIH) {
    const { kunci, nonaktif, level: _level, ...badan } = x;
    const baru = await buatPart(pemilik.token, { ...badan, unit: 'pcs', price: 55000 });
    s[kunci] = nonaktif ? await ubahPart(pemilik.token, baru.partId, { isActive: false }) : baru;
  }
  const kampas = ['kampas1', 'kampas2'].sort((a, b) => urutId(s[a].partId, s[b].partId));
  URUTAN = ['aki', 'busi', 'emblem', 'filterP', 'filterX', ...kampas, 'oli'];
});

function daftar(query: Query | string = {}, token: string | null = pemilik.token): Promise<Respons> {
  return kirimDaftarPart(token, query);
}

function idDari(res: Respons): string[] {
  return res.body.data.map((x: any) => x.partId);
}

// Kunci benih yang cocok, dalam urutan daftar.
function cocok(...kunci: string[]): string[] {
  return URUTAN.filter((k) => kunci.includes(k)).map((k) => s[k].partId);
}

describe('GET /api/parts: bentuk baris per peran', () => {
  it('pemilik: setiap baris memuat costPrice dan sama dengan sparepart yang dibuat; stockLevel sesuai benih', async () => {
    const res = await daftar({ limit: 50 });

    harapStatus(res, 200);
    for (const x of BENIH) {
      const baris = res.body.data.find((r: any) => r.partId === s[x.kunci].partId);
      expect('costPrice' in baris, x.kunci).toBe(true);
      expect(baris, x.kunci).toEqual(s[x.kunci]);
      expect(baris, x.kunci).toMatchObject({ costPrice: x.costPrice, stock: x.initialStock, minStock: x.minStock, stockLevel: x.level, isActive: !x.nonaktif });
    }
  });

  it.each([
    ['kasir', () => kasir],
    ['mekanik', () => mekanik],
  ])('%s: kunci costPrice tidak ada sama sekali (bukan null, bukan 0); field lain sama dengan milik pemilik, termasuk stok', async (_judul, sesi) => {
    const milikPemilik = await daftar({ limit: 50 });
    const res = await daftar({ limit: 50 }, sesi().token);

    harapStatus(res, 200);
    expect(idDari(res)).toEqual(idDari(milikPemilik));
    for (const [i, baris] of res.body.data.entries()) {
      expect('costPrice' in baris, baris.sku).toBe(false);
      expect(baris).toEqual(tanpaHargaBeli(milikPemilik.body.data[i]));
    }
  });

  it('kasir dengan filter yang hanya menyisakan sparepart berharga beli 0 juga tanpa costPrice', async () => {
    const res = await daftar({ search: 'busi' }, kasir.token);

    expect(res.body.data).toHaveLength(1);
    expect(Object.keys(res.body.data[0])).not.toContain('costPrice');
  });
});

describe('GET /api/parts: urutan dan paginasi', () => {
  it('semua sparepart termasuk nonaktif, urut nama tanpa membedakan huruf besar dan aksen, lalu partId; meta bawaan', async () => {
    const res = await daftar();

    harapStatus(res, 200);
    expect(idDari(res)).toEqual(cocok(...URUTAN));
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 8 });
  });

  it('paginasi: halaman bersambung tanpa celah, total tidak ikut terpotong, halaman di luar isi → data kosong', async () => {
    const gabungan: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await daftar({ page, limit: 3 }, kasir.token);

      harapStatus(res, 200);
      expect(res.body.meta).toEqual({ page, limit: 3, total: 8 });
      expect(res.body.data).toHaveLength(page === 3 ? 2 : 3);
      gabungan.push(...idDari(res));
    }

    expect(gabungan).toEqual(cocok(...URUTAN));
    expect((await daftar({ page: 4, limit: 3 })).body).toEqual({ data: [], meta: { page: 4, limit: 3, total: 8 } });
    expect((await daftar({ page: 1_000_000 }, mekanik.token)).body).toEqual({ data: [], meta: { page: 1_000_000, limit: 20, total: 8 } });
  });
});

describe('GET /api/parts: filter', () => {
  it.each([
    ['nama sebagian, huruf besar', { search: 'BUSI IR' }, ['busi']],
    ['nama tanpa aksen menemukan nama beraksen', { search: 'emblem' }, ['emblem']],
    // Term non-ASCII juga dicocokkan ke SKU (kolom ascii): tidak boleh menjadi 500, cukup tidak cocok.
    ['term beraksen menemukan nama lewat collation', { search: 'ÈMBLEM' }, ['emblem']],
    ['term beraksen pada nama tanpa aksen', { search: 'Kâmpas' }, ['kampas1', 'kampas2']],
    ['SKU dengan huruf kecil', { search: 'aki-5' }, ['aki']],
    ['SKU (disimpan huruf besar dari masukan huruf kecil)', { search: 'BUSI-IR' }, ['busi']],
    ['SKU yang cocok dua sparepart', { search: 'kr-0' }, ['kampas1', 'kampas2']],
    ['term non-ASCII tidak pernah cocok dengan SKU (bukan galat collation)', { search: 'émb-01' }, []],
    ['term non-ASCII tidak pernah cocok dengan SKU, juga huruf lebar penuh', { search: 'ＫＲ-01' }, []],
    ['nama atau SKU, nonaktif ikut', { search: 'oli' }, ['oli']],
    ['% dicocokkan apa adanya', { search: '50%' }, ['filterP']],
    ['_ dicocokkan apa adanya', { search: '_U' }, ['filterP']],
    ['dipangkas', { search: '  busi \t' }, ['busi']],
    ['tidak ada yang cocok', { search: 'zzzz' }, []],
    ['isActive=true', { isActive: 'true' }, ['aki', 'busi', 'emblem', 'filterP', 'filterX', 'kampas1', 'kampas2']],
    ['isActive=false', { isActive: 'false' }, ['oli']],
    ['lowStock=true: stock <= minStock (low dan out)', { lowStock: 'true' }, ['aki', 'busi', 'kampas2', 'oli']],
    ['lowStock=false: stock > minStock', { lowStock: 'false' }, ['emblem', 'filterP', 'filterX', 'kampas1']],
    ['lowStock dan isActive', { lowStock: 'true', isActive: 'true' }, ['aki', 'busi', 'kampas2']],
    ['lowStock dan search', { lowStock: 'true', search: 'kampas' }, ['kampas2']],
    ['ketiganya', { lowStock: 'false', isActive: 'true', search: 'filter' }, ['filterP', 'filterX']],
  ])('%s', async (_judul, query, kunci) => {
    for (const sesi of [pemilik, kasir]) {
      const res = await daftar(query, sesi.token);

      harapStatus(res, 200);
      expect(idDari(res)).toEqual(cocok(...kunci));
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: kunci.length });
    }
  });

  it('search kosong atau hanya spasi = tanpa filter; "+" berarti spasi; %FF → daftar kosong 200', async () => {
    expect(idDari(await daftar('search='))).toEqual(cocok(...URUTAN));
    expect(idDari(await daftar({ search: '   ' }))).toEqual(cocok(...URUTAN));
    expect(idDari(await daftar('search=Kampas+Rem'))).toEqual(cocok('kampas1', 'kampas2'));
    expect((await daftar('search=%FF')).body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it('filter dengan paginasi: total = jumlah yang cocok', async () => {
    const res = await daftar({ lowStock: 'true', limit: 2, page: 2 });

    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 4 });
    expect(idDari(res)).toEqual(cocok('kampas2', 'oli'));
  });
});

describe('GET /api/parts: validasi query dan urutan pemeriksaan', () => {
  it.each([
    ['isActive kosong', 'isActive=', { isActive: 'invalid_format' }],
    ['isActive=1', 'isActive=1', { isActive: 'invalid_format' }],
    ['isActive=TRUE', 'isActive=TRUE', { isActive: 'invalid_format' }],
    ['lowStock kosong', 'lowStock=', { lowStock: 'invalid_format' }],
    ['lowStock=0', 'lowStock=0', { lowStock: 'invalid_format' }],
    ['lowStock=True', 'lowStock=True', { lowStock: 'invalid_format' }],
    ['page=0', 'page=0', { page: 'out_of_range' }],
    ['page huruf', 'page=abc', { page: 'invalid_format' }],
    ['limit=51', 'limit=51', { limit: 'out_of_range' }],
    ['semua sekaligus', 'isActive=yes&lowStock=&page=-1&limit=0', { isActive: 'invalid_format', lowStock: 'invalid_format', page: 'invalid_format', limit: 'out_of_range' }],
  ])('%s → 422 (untuk semua peran)', async (_judul, query, fields) => {
    for (const sesi of [pemilik, kasir, mekanik]) {
      harapGalat(await daftar(query, sesi.token), 422, 'validation_failed', fields);
    }
  });

  it('urutan: 401 → 422 (tidak ada langkah 403: semua peran boleh)', async () => {
    harapGalat(await daftar('lowStock=1', null), 401, 'unauthenticated');
    harapGalat(await daftar('lowStock=1', 'x'.repeat(43)), 401, 'unauthenticated');
    harapGalat(await daftar('lowStock=1', mekanik.token), 422, 'validation_failed', { lowStock: 'invalid_format' });
  });
});
