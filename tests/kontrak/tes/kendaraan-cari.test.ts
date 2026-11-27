// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// GET /api/vehicles?plate= (cari plat dalam bentuk ketikan apa pun, beserta pemiliknya) dan
// GET /api/vehicles/{vehicleId}/work-orders (riwayat servis satu kendaraan).
//
// Kendaraan untuk pencarian plat dibangun di awal dan tidak ditambah sesudahnya (kendaraan untuk
// riwayat servis memakai plat berawalan "W", yang tidak memuat potongan yang dicari). Kunci benih:
//   AB1234C · B1234 · B1234XYZ · D5678EF · Z9B1234
// "B1234" cocok dengan empat kunci: yang sama persis dulu, lalu kunci naik (urutan biner).

import { beforeAll, describe, expect, it } from 'vitest';
import {
  batalkanSpk,
  buatKasir,
  buatMekanik,
  buatPelanggan,
  buatPemilik,
  buatSpk,
  tambahKendaraan,
  type SesiStaf,
} from '../src/data';
import { idSpk, jalankan, teksUtc, urutkanSpk } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { type Respons } from '../src/klien';
import { ID_TAK_ADA, idDianggapTakAda, kirimCariKendaraan, kirimRiwayat, type Query, ringkasPelanggan, urutId } from './pembantu-pelanggan';

let pemilik: SesiStaf;
let kasir: SesiStaf;
let mekanik: SesiStaf;
let budi: any;
let sari: any;
const k: Record<string, any> = {};

beforeAll(async () => {
  pemilik = await buatPemilik();
  kasir = await buatKasir();
  mekanik = await buatMekanik();
  budi = await buatPelanggan(kasir.token, { name: 'Budi Santoso' });
  sari = await buatPelanggan(kasir.token, { name: 'Sari Dewi' });
  k.b1234xyz = await tambahKendaraan(kasir.token, budi.customerId, { plate: 'b 1234 xyz' });
  k.b1234 = await tambahKendaraan(kasir.token, sari.customerId, { plate: 'B-1234' });
  k.ab1234c = await tambahKendaraan(kasir.token, budi.customerId, { plate: 'ab1234c', type: 'CAR', brand: 'Toyota', model: 'Avanza' });
  k.z9b1234 = await tambahKendaraan(kasir.token, sari.customerId, { plate: 'z9b1234' });
  k.d5678ef = await tambahKendaraan(kasir.token, budi.customerId, { plate: 'D 5678 EF' });
});

function cari(query: Query | string, token: string | null = kasir.token): Promise<Respons> {
  return kirimCariKendaraan(token, query);
}

function kunciDari(res: Respons): string[] {
  return res.body.data.map((x: any) => x.vehicle.plateKey);
}

describe('GET /api/vehicles?plate=', () => {
  it('contoh spec "b1234": kunci yang sama persis dulu, lalu kunci naik; tiap baris memuat kendaraan dan pemiliknya', async () => {
    const res = await cari({ plate: 'b1234' });

    harapStatus(res, 200);
    expect(kunciDari(res)).toEqual(['B1234', 'AB1234C', 'B1234XYZ', 'Z9B1234']);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 4 });
    const pemilikKendaraan: Record<string, any> = { B1234: sari, AB1234C: budi, B1234XYZ: budi, Z9B1234: sari };
    const kendaraan: Record<string, any> = { B1234: k.b1234, AB1234C: k.ab1234c, B1234XYZ: k.b1234xyz, Z9B1234: k.z9b1234 };
    for (const baris of res.body.data) {
      const kunci = baris.vehicle.plateKey;
      expect(baris, kunci).toEqual({ vehicle: kendaraan[kunci], customer: ringkasPelanggan(pemilikKendaraan[kunci]) });
    }
  });

  it('bentuk tampilan sesuai PlatMasukan: "B 1234 XYZ", "B 1234", "AB 1234 C", dan "Z9B1234" (tidak mengikuti pola)', async () => {
    const res = await cari({ plate: '1234' });

    expect(res.body.data.map((x: any) => x.vehicle.plate)).toEqual(['AB 1234 C', 'B 1234', 'B 1234 XYZ', 'Z9B1234']);
  });

  it.each([
    ['huruf kecil dengan spasi', 'b 1234', ['B1234', 'AB1234C', 'B1234XYZ', 'Z9B1234']],
    ['tanda hubung dan titik', ' b-12.34 ', ['B1234', 'AB1234C', 'B1234XYZ', 'Z9B1234']],
    ['diawali angka (bagian tengah), tanpa yang sama persis', '1234', ['AB1234C', 'B1234', 'B1234XYZ', 'Z9B1234']],
    ['bagian belakang', '1234x', ['B1234XYZ']],
    ['huruf belakang saja', 'xyz', ['B1234XYZ']],
    ['kunci utuh dalam bentuk tampilan', 'B 1234 XYZ', ['B1234XYZ']],
    ['kunci utuh yang juga bagian kunci lain', 'ab1234c', ['AB1234C']],
    ['tidak ada yang cocok', 'q', []],
  ])('%s: "%s"', async (_judul, plate, harapan) => {
    const res = await cari({ plate });

    harapStatus(res, 200);
    expect(kunciDari(res)).toEqual(harapan);
    expect(res.body.meta.total).toBe(harapan.length);
  });

  it('"+" di query berarti spasi; tab dan baris baru di ujung dipangkas', async () => {
    expect(kunciDari(await cari('plate=B+1234+XYZ'))).toEqual(['B1234XYZ']);
    expect(kunciDari(await cari({ plate: '\tD 5678 ef\n' }))).toEqual(['D5678EF']);
  });

  it('paginasi: halaman bersambung tanpa celah; total semua yang cocok', async () => {
    const satu = await cari({ plate: 'b1234', limit: 3 });
    const dua = await cari({ plate: 'b1234', limit: 3, page: 2 });
    const tiga = await cari({ plate: 'b1234', limit: 3, page: 3 });

    expect(satu.body.meta).toEqual({ page: 1, limit: 3, total: 4 });
    expect(dua.body.meta).toEqual({ page: 2, limit: 3, total: 4 });
    expect([...kunciDari(satu), ...kunciDari(dua)]).toEqual(['B1234', 'AB1234C', 'B1234XYZ', 'Z9B1234']);
    expect(tiga.body).toEqual({ data: [], meta: { page: 3, limit: 3, total: 4 } });
  });

  it('pemilik juga boleh; mekanik → 403; tanpa token → 401', async () => {
    harapStatus(await cari({ plate: 'b1234' }, pemilik.token), 200);
    harapGalat(await cari({ plate: 'b1234' }, mekanik.token), 403, 'forbidden');
    harapGalat(await cari({ plate: 'b1234' }, null), 401, 'unauthenticated');
  });

  it.each([
    ['tidak dikirim', '', { plate: 'required' }],
    ['kosong', 'plate=', { plate: 'required' }],
    ['kosong sesudah dinormalkan', 'plate=%20-.%20', { plate: 'required' }],
    ['garis miring', 'plate=B%2F1', { plate: 'invalid_format' }],
    ['huruf non-ASCII', 'plate=%C3%891', { plate: 'invalid_format' }],
    ['13 karakter sesudah dinormalkan', 'plate=B+1234+ABCDEFGH', { plate: 'too_long' }],
    ['plate kosong dan page salah sekaligus', 'page=0&limit=x', { plate: 'required', page: 'out_of_range', limit: 'invalid_format' }],
    ['limit=51', 'plate=B&limit=51', { limit: 'out_of_range' }],
  ])('%s → 422', async (_judul, query, fields) => {
    harapGalat(await cari(query), 422, 'validation_failed', fields);
  });

  it('12 karakter sesudah dinormalkan masih sah', async () => {
    const res = await cari({ plate: 'ABCD-1234-EFGH' });

    harapStatus(res, 200);
    expect(res.body.data).toEqual([]);
  });

  it('urutan: 401 → 403 → 422', async () => {
    harapGalat(await cari('', null), 401, 'unauthenticated');
    harapGalat(await cari('', mekanik.token), 403, 'forbidden');
    harapGalat(await cari('', pemilik.token), 422, 'validation_failed', { plate: 'required' });
  });
});

describe('GET /api/vehicles/{vehicleId}/work-orders', () => {
  const riwayat = (vehicleId: string, query: Query | string = {}, token: string | null = kasir.token) => kirimRiwayat(token, vehicleId, query);
  const nomorDari = (res: Respons): string[] => res.body.data.map((x: any) => x.number);

  it('kendaraan tanpa SPK → data kosong dan meta bawaan', async () => {
    const v = await tambahKendaraan(kasir.token, budi.customerId, { plate: 'W 1 AA' });

    const res = await riwayat(v.vehicleId);

    harapStatus(res, 200);
    expect(res.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it('semua SPK kendaraan itu termasuk yang dibatalkan, terbaru dulu; SPK kendaraan lain tidak ikut', async () => {
    const v = await tambahKendaraan(kasir.token, budi.customerId, { plate: 'W 2 AA', brand: 'Suzuki', model: 'Satria' });
    const lainnya = await tambahKendaraan(kasir.token, budi.customerId, { plate: 'W 3 AA' });
    const s1 = await buatSpk(kasir.token, v.vehicleId, { complaint: 'Ganti oli.' });
    const s2 = await buatSpk(kasir.token, v.vehicleId, { complaint: 'Rem bunyi.' });
    const s3 = await buatSpk(kasir.token, v.vehicleId, { complaint: 'Mesin mati.' });
    const asing = await buatSpk(kasir.token, lainnya.vehicleId);
    await batalkanSpk(kasir.token, s2.number);
    await urutkanSpk([s1.number, s2.number, asing.number, s3.number]);

    const res = await riwayat(v.vehicleId);

    harapStatus(res, 200);
    expect(nomorDari(res)).toEqual([s3.number, s2.number, s1.number]);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 3 });
    expect(res.body.data.map((x: any) => x.status)).toEqual(['QUEUED', 'CANCELLED', 'QUEUED']);
    expect(res.body.data[2]).toMatchObject({
      number: s1.number,
      paymentStatus: 'paid',
      customer: ringkasPelanggan(budi),
      vehicle: { vehicleId: v.vehicleId, type: 'MOTOR', plate: 'W 2 AA', brand: 'Suzuki', model: 'Satria' },
      mechanic: null,
      complaint: 'Ganti oli.',
      itemCount: 0,
      total: 0,
      paidAmount: 0,
    });
  });

  it('waktu dibuat sama dipisahkan work_order_id turun', async () => {
    const v = await tambahKendaraan(kasir.token, budi.customerId, { plate: 'W 4 AA' });
    const spk: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      spk.push((await buatSpk(kasir.token, v.vehicleId)).number);
    }
    const waktu = teksUtc('2026-03-10T03:00:00.000Z');
    const id: Record<string, string> = {};
    for (const nomor of spk) {
      await jalankan('UPDATE work_orders SET created_at = ? WHERE number = ?', [waktu, nomor]);
      id[nomor] = await idSpk(nomor);
    }

    const res = await riwayat(v.vehicleId);

    expect(nomorDari(res)).toEqual([...spk].sort((a, b) => urutId(id[b] ?? '', id[a] ?? '')));
  });

  it('paginasi: halaman bersambung tanpa celah, total tidak ikut terpotong', async () => {
    const v = await tambahKendaraan(kasir.token, sari.customerId, { plate: 'W 5 AA' });
    const spk: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      spk.push((await buatSpk(kasir.token, v.vehicleId)).number);
    }
    await urutkanSpk(spk);
    const terbaru = [...spk].reverse();

    const satu = await riwayat(v.vehicleId, { limit: 2 });
    const dua = await riwayat(v.vehicleId, { limit: 2, page: 2 });
    const tiga = await riwayat(v.vehicleId, { limit: 2, page: 3 });
    const empat = await riwayat(v.vehicleId, { limit: 2, page: 4 });

    expect(satu.body.meta).toEqual({ page: 1, limit: 2, total: 5 });
    expect([...nomorDari(satu), ...nomorDari(dua), ...nomorDari(tiga)]).toEqual(terbaru);
    expect(empat.body).toEqual({ data: [], meta: { page: 4, limit: 2, total: 5 } });
  });

  it('pemilik juga boleh; mekanik → 403; tanpa token → 401', async () => {
    harapStatus(await riwayat(k.b1234.vehicleId, {}, pemilik.token), 200);
    harapGalat(await riwayat(k.b1234.vehicleId, {}, mekanik.token), 403, 'forbidden');
    harapGalat(await riwayat(k.b1234.vehicleId, {}, null), 401, 'unauthenticated');
  });

  it.each([
    ['page=0', 'page=0', { page: 'out_of_range' }],
    ['page huruf', 'page=abc', { page: 'invalid_format' }],
    ['limit=51', 'limit=51', { limit: 'out_of_range' }],
    ['limit kosong', 'limit=', { limit: 'invalid_format' }],
  ])('%s → 422', async (_judul, query, fields) => {
    harapGalat(await riwayat(k.b1234.vehicleId, query), 422, 'validation_failed', fields);
  });

  it('urutan: 401 → 403 → 404 (tidak ada, huruf besar, bukan UUID) → 422', async () => {
    harapGalat(await riwayat(ID_TAK_ADA, 'page=0', null), 401, 'unauthenticated');
    harapGalat(await riwayat(ID_TAK_ADA, 'page=0', mekanik.token), 403, 'forbidden');
    for (const id of idDianggapTakAda(k.b1234.vehicleId)) {
      harapGalat(await riwayat(id, 'page=0'), 404, 'not_found');
    }
    harapGalat(await riwayat(k.b1234.vehicleId, 'page=0'), 422, 'validation_failed', { page: 'out_of_range' });
  });
});
