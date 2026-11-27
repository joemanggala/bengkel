// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// GET /api/customers: urutan, paginasi, dan `search` yang mencocokkan nama (%, _, dan \ apa
// adanya; huruf besar/kecil dan aksen tidak membedakan), nomor HP dalam bentuk ketikan apa pun,
// atau plat salah satu kendaraannya.
//
// Berkas ini membangun seluruh daftar pelanggan di awal dan tidak menambah atau mengubahnya
// sesudahnya, jadi daftar tanpa filter sama persis dengan benih di bawah. Urutan harapan (name naik
// menurut collation utf8mb4_0900_ai_ci, lalu customer_id naik):
//   Agus Salim · budi santoso = Budi Santoso (dipisahkan customer_id) · Édi Wijaya ·
//   Fajar 50% Motor_Jaya · Fajar 50X MotorXJaya · Garasi A\B Motor · Garasi AB Motor
// Tanda baca (%, \) diurutkan sebelum huruf; "Édi" jatuh di antara "Budi" dan "Fajar".
// Nomor dan plat benih dipilih supaya tiap term pencarian hanya cocok lewat satu aturan.

import { beforeAll, describe, expect, it } from 'vitest';
import { buatKasir, buatMekanik, buatPelanggan, buatPemilik, tambahKendaraan, type SesiStaf } from '../src/data';
import { harapGalat, harapStatus } from '../src/galat';
import { type Respons } from '../src/klien';
import { detailPelanggan, kirimDaftarPelanggan, type Query, urutId } from './pembantu-pelanggan';

let pemilik: SesiStaf;
let kasir: SesiStaf;
let mekanik: SesiStaf;
const p: Record<string, any> = {};

const BENIH = [
  { kunci: 'agus', name: 'Agus Salim', phone: '0811-1000-2001', plates: ['B 1234 XYZ'] },
  { kunci: 'budiKecil', name: 'budi santoso', phone: '+62 812 7000 3002', plates: [] },
  { kunci: 'budiBesar', name: 'Budi Santoso', phone: '6281370004003', plates: ['D 55 QR', 'd-66-qs'] },
  { kunci: 'edi', name: 'Édi Wijaya', phone: '0857-0000-5004', plates: [] },
  { kunci: 'fajarPersen', name: 'Fajar 50% Motor_Jaya', phone: '0858 0000 6005', plates: [] },
  { kunci: 'fajarX', name: 'Fajar 50X MotorXJaya', phone: '0859-0000-7006', plates: [] },
  { kunci: 'garasiMiring', name: 'Garasi A\\B Motor', phone: '0877 0000 8007', plates: [] },
  { kunci: 'garasiAB', name: 'Garasi AB Motor', phone: '0878 0000 9008', plates: [] },
];

let URUTAN: string[] = [];

beforeAll(async () => {
  pemilik = await buatPemilik();
  kasir = await buatKasir();
  mekanik = await buatMekanik();
  for (const x of BENIH) {
    const baru = await buatPelanggan(kasir.token, { name: x.name, phone: x.phone });
    for (const plate of x.plates) {
      await tambahKendaraan(kasir.token, baru.customerId, { plate });
    }
    p[x.kunci] = await detailPelanggan(kasir.token, baru.customerId);
  }
  const budi = ['budiKecil', 'budiBesar'].sort((a, b) => urutId(p[a].customerId, p[b].customerId));
  URUTAN = ['agus', ...budi, 'edi', 'fajarPersen', 'fajarX', 'garasiMiring', 'garasiAB'];
});

function daftar(query: Query | string = {}, token: string | null = kasir.token): Promise<Respons> {
  return kirimDaftarPelanggan(token, query);
}

function idDari(res: Respons): string[] {
  return res.body.data.map((x: any) => x.customerId);
}

function ke(kunci: string[]): string[] {
  return kunci.map((k) => p[k].customerId);
}

// Kunci benih yang cocok, dalam urutan daftar.
function cocok(...kunci: string[]): string[] {
  return ke(URUTAN.filter((k) => kunci.includes(k)));
}

describe('GET /api/customers', () => {
  it('semua pelanggan urut nama tanpa membedakan huruf besar dan aksen, lalu customerId; meta bawaan', async () => {
    const res = await daftar();

    harapStatus(res, 200);
    expect(idDari(res)).toEqual(ke(URUTAN));
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 8 });
  });

  it('nomor HP tersimpan dalam bentuk seragam 628…', async () => {
    const res = await daftar();

    const nomor = Object.fromEntries(res.body.data.map((x: any) => [x.name, x.phone]));
    expect(nomor).toEqual({
      'Agus Salim': '6281110002001',
      'budi santoso': '6281270003002',
      'Budi Santoso': '6281370004003',
      'Édi Wijaya': '6285700005004',
      'Fajar 50% Motor_Jaya': '6285800006005',
      'Fajar 50X MotorXJaya': '6285900007006',
      'Garasi A\\B Motor': '6287700008007',
      'Garasi AB Motor': '6287800009008',
    });
  });

  it('setiap baris memuat semua kendaraannya (sama dengan rincian pelanggan); tanpa kendaraan → []', async () => {
    const res = await daftar();

    for (const k of URUTAN) {
      const baris = res.body.data.find((x: any) => x.customerId === p[k].customerId);
      expect(baris, k).toEqual(p[k]);
    }
    const budi = res.body.data.find((x: any) => x.customerId === p.budiBesar.customerId);
    expect(budi.vehicles.map((v: any) => v.plate).sort()).toEqual(['D 55 QR', 'D 66 QS']);
    expect(res.body.data.find((x: any) => x.customerId === p.edi.customerId).vehicles).toEqual([]);
  });

  it('pemilik juga boleh; mekanik → 403; tanpa token → 401', async () => {
    harapStatus(await daftar({}, pemilik.token), 200);
    harapGalat(await daftar({}, mekanik.token), 403, 'forbidden');
    harapGalat(await daftar({}, null), 401, 'unauthenticated');
  });

  it('paginasi: halaman bersambung tanpa celah, total tidak ikut terpotong, halaman di luar isi → data kosong', async () => {
    const gabungan: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await daftar({ page, limit: 3 });

      harapStatus(res, 200);
      expect(res.body.meta).toEqual({ page, limit: 3, total: 8 });
      expect(res.body.data).toHaveLength(page === 3 ? 2 : 3);
      gabungan.push(...idDari(res));
    }

    expect(gabungan).toEqual(ke(URUTAN));
    expect((await daftar({ page: 4, limit: 3 })).body).toEqual({ data: [], meta: { page: 4, limit: 3, total: 8 } });
    expect((await daftar({ page: 1_000_000 })).body).toEqual({ data: [], meta: { page: 1_000_000, limit: 20, total: 8 } });
    expect((await daftar({ limit: 50 })).body.meta).toEqual({ page: 1, limit: 50, total: 8 });
    expect(idDari(await daftar({ page: 8, limit: 1 }))).toEqual(ke(URUTAN.slice(7)));
  });
});

describe('GET /api/customers: search', () => {
  it.each([
    ['nama sebagian', 'agus', ['agus']],
    ['nama huruf besar', 'AGUS SAL', ['agus']],
    ['nama tanpa aksen menemukan nama beraksen', 'edi wij', ['edi']],
    ['term beraksen (non-ASCII) menemukan nama', 'ÉDI', ['edi']],
    ['term beraksen pada nama tanpa aksen', 'Ágús', ['agus']],
    ['nama: huruf besar/kecil tidak membedakan', 'BUDI', ['budiKecil', 'budiBesar']],
    ['% dicocokkan apa adanya, bukan wildcard', '50%', ['fajarPersen']],
    ['_ dicocokkan apa adanya, bukan wildcard', 'r_J', ['fajarPersen']],
    ['\\ dicocokkan apa adanya, bukan escape', 'A\\B', ['garasiMiring']],
    ['nomor HP: awalan 0 dengan tanda hubung', '0811-10', ['agus']],
    ['nomor HP: potongan tengah tanpa awalan', '70003', ['budiKecil']],
    ['nomor HP: awalan +62 dengan spasi', '+62 857', ['edi']],
    ['nomor HP: awalan 62', '62813', ['budiBesar']],
    ['nomor HP: bentuk seragam utuh', '6285900007006', ['fajarX']],
    ['nomor HP: spasi dan tanda hubung di mana pun', '08 78-0000 90', ['garasiAB']],
    ['nomor HP: tanpa + cocok sebagai potongan tengah', '81110', ['agus']],
    ['nomor HP: awalan + selain +62 tidak pernah cocok', '+81110', []],
    ['nomor HP: +0… tidak pernah cocok', '+0811-10', []],
    ['plat dengan spasi dan huruf kecil', 'b 1234', ['agus']],
    ['plat dengan titik dan tanda hubung', 'b.12-34.x', ['agus']],
    ['plat kendaraan kedua', 'qs', ['budiBesar']],
    ['dua kendaraan cocok, pelanggannya tetap sekali', 'q', ['budiBesar']],
    ['tidak ada yang cocok', 'zzzz', []],
  ])('%s: "%s"', async (_judul, search, kunci) => {
    const res = await daftar({ search });

    harapStatus(res, 200);
    expect(idDari(res)).toEqual(cocok(...kunci));
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: kunci.length });
  });

  it('dipangkas: spasi di ujung diabaikan; kosong atau hanya spasi = tanpa filter', async () => {
    expect(idDari(await daftar({ search: '  agus \t' }))).toEqual(cocok('agus'));
    expect(idDari(await daftar('search='))).toEqual(ke(URUTAN));
    expect(idDari(await daftar({ search: '   ' }))).toEqual(ke(URUTAN));
  });

  it('"+" di query berarti spasi', async () => {
    const res = await daftar('search=Budi+Santoso');

    expect(idDari(res)).toEqual(cocok('budiKecil', 'budiBesar'));
  });

  it('term dengan byte UTF-8 tidak sah (%FF) tidak pernah cocok: daftar kosong 200', async () => {
    const res = await daftar('search=%FF');

    harapStatus(res, 200);
    expect(res.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it('search digabung dengan paginasi: total = jumlah yang cocok', async () => {
    const pertama = await daftar({ search: 'budi', limit: 1 });
    const kedua = await daftar({ search: 'budi', limit: 1, page: 2 });

    expect(pertama.body.meta).toEqual({ page: 1, limit: 1, total: 2 });
    expect([...idDari(pertama), ...idDari(kedua)]).toEqual(cocok('budiKecil', 'budiBesar'));
  });
});

describe('GET /api/customers: validasi query dan urutan pemeriksaan', () => {
  it.each([
    ['page=0', 'page=0', { page: 'out_of_range' }],
    ['page=1000001', 'page=1000001', { page: 'out_of_range' }],
    ['page kosong', 'page=', { page: 'invalid_format' }],
    ['page huruf', 'page=abc', { page: 'invalid_format' }],
    ['page negatif', 'page=-1', { page: 'invalid_format' }],
    ['page pecahan', 'page=1.5', { page: 'invalid_format' }],
    ['page diawali +', 'page=%2B1', { page: 'invalid_format' }],
    ['limit=0', 'limit=0', { limit: 'out_of_range' }],
    ['limit=51', 'limit=51', { limit: 'out_of_range' }],
    ['limit kosong', 'limit=', { limit: 'invalid_format' }],
    ['titik koma adalah data: limit=1;page=2', 'limit=1;page=2', { limit: 'invalid_format' }],
    ['page dan limit sekaligus', 'page=0&limit=abc', { page: 'out_of_range', limit: 'invalid_format' }],
  ])('%s → 422', async (_judul, query, fields) => {
    harapGalat(await daftar(query), 422, 'validation_failed', fields);
  });

  it('urutan: 401 → 403 → 422', async () => {
    harapGalat(await daftar('page=0', null), 401, 'unauthenticated');
    harapGalat(await daftar('page=0', mekanik.token), 403, 'forbidden');
    harapGalat(await daftar('page=0', pemilik.token), 422, 'validation_failed', { page: 'out_of_range' });
  });
});
