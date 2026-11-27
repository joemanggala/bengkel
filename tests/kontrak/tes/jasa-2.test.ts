// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import {
  bookingStaf,
  buatBookingPublik,
  buatJasa,
  buatKasir,
  buatMekanik,
  buatPelangganDenganKendaraan,
  buatPemilik,
  buatSpk,
  detailSpk,
  jadikanSpk,
  namaUnik,
  tambahJasa,
  type SesiStaf,
} from '../src/data';
import { bacaSatu } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { badanUtf8Rusak, JSON_RUSAK, jsonLebihDariSatuMib, tokenAcak } from './pembantu-fondasi';
import { KUNCI_JASA } from './pembantu-staf';

// PATCH /api/services/{serviceId} beserta akibatnya pada booking dan SPK
// yang sudah ada. Setiap tes membuat jasanya sendiri.

let pemilik: SesiStaf;
let kasir: SesiStaf;
let mekanik: SesiStaf;

function ubah(serviceId: string, json: unknown, token: string | undefined = pemilik.token): Promise<Respons> {
  return api.patch(`/api/services/${serviceId}`, { token, json });
}

async function jasaApi(serviceId: string): Promise<any> {
  return (await api.get('/api/services', { token: kasir.token })).body.data.find((j: any) => j.serviceId === serviceId);
}

beforeAll(async () => {
  pemilik = await buatPemilik();
  kasir = await buatKasir();
  mekanik = await buatMekanik();
});

describe('PATCH /api/services/{serviceId}', () => {
  it('perubahan sebagian: hanya field yang dikirim berubah; teks dipangkas; field lain di badan diabaikan', async () => {
    const jasa = await buatJasa(pemilik.token, { description: 'Lama', durationMinutes: 30, sortOrder: 4 });
    const nama = namaUnik('Servis Ringan');

    const res = await ubah(jasa.serviceId, { name: ` ${nama}\n`, price: 40000, serviceId: randomUUID(), createdAt: '2000-01-01T00:00:00Z', lain: 1 });

    harapStatus(res, 200);
    expect(Object.keys(res.body.data).sort()).toEqual(KUNCI_JASA);
    // updatedAt tidak dibandingkan di sini; aturannya diuji di waktu-ubah.test.ts.
    harapSetara({ ...res.body.data, updatedAt: undefined }, { ...jasa, name: nama, price: 40000, updatedAt: undefined });
    expect(await jasaApi(jasa.serviceId)).toEqual(res.body.data);
  });

  it('{} → 200 tanpa perubahan', async () => {
    const jasa = await buatJasa(pemilik.token);

    const res = await ubah(jasa.serviceId, {});

    harapStatus(res, 200);
    harapSetara({ ...res.body.data, updatedAt: undefined }, { ...jasa, updatedAt: undefined });
  });

  it('setiap field bisa diubah sendiri-sendiri, termasuk mengosongkan durasi dengan null', async () => {
    const jasa = await buatJasa(pemilik.token, { durationMinutes: 45 });
    const kasus: Array<[Record<string, unknown>, Record<string, unknown>]> = [
      [{ description: '  Ganti oli dan filter.\n' }, { description: 'Ganti oli dan filter.' }],
      [{ description: '' }, { description: '' }],
      [{ durationMinutes: 1440 }, { durationMinutes: 1440 }],
      [{ durationMinutes: null }, { durationMinutes: null }],
      [{ isPublic: false }, { isPublic: false }],
      [{ isActive: false }, { isActive: false }],
      [{ isActive: true, isPublic: true }, { isActive: true, isPublic: true }],
      [{ sortOrder: 100000 }, { sortOrder: 100000 }],
      [{ price: 0 }, { price: 0 }],
      [{ price: 100000000 }, { price: 100000000 }],
    ];

    for (const [isi, harapan] of kasus) {
      const res = await ubah(jasa.serviceId, isi);
      harapStatus(res, 200);
      expect(res.body.data, JSON.stringify(isi)).toMatchObject(harapan);
    }
    expect(await jasaApi(jasa.serviceId)).toMatchObject({ name: jasa.name, description: '', durationMinutes: null, sortOrder: 100000, price: 100000000 });
  });

  it('nama dipakai jasa lain (beda huruf, aksen, spasi di tepi, termasuk jasa nonaktif) → 409 service_name_taken tanpa perubahan', async () => {
    const lain = await buatJasa(pemilik.token, { name: namaUnik('Cek Rem'), isActive: false });
    const jasa = await buatJasa(pemilik.token);

    for (const kembar of [lain.name, lain.name.toUpperCase(), lain.name.replace('Rem', 'Rém'), `  ${lain.name} `]) {
      harapGalat(await ubah(jasa.serviceId, { name: kembar, price: 1 }), 409, 'service_name_taken');
    }
    expect(await jasaApi(jasa.serviceId)).toMatchObject({ name: jasa.name, price: jasa.price });
  });

  it('nama sendiri, juga bila hanya beda huruf besar/kecil, bukan bentrok', async () => {
    const jasa = await buatJasa(pemilik.token, { name: namaUnik('Spooring') });

    harapStatus(await ubah(jasa.serviceId, { name: jasa.name }), 200);
    const res = await ubah(jasa.serviceId, { name: jasa.name.toUpperCase() });

    harapStatus(res, 200);
    expect(res.body.data.name).toBe(jasa.name.toUpperCase());
  });

  it('null pada name atau price → required; null pada description, isPublic, isActive, sortOrder → invalid_type', async () => {
    const jasa = await buatJasa(pemilik.token);

    harapGalat(await ubah(jasa.serviceId, { name: null, price: null }), 422, 'validation_failed', { name: 'required', price: 'required' });
    harapGalat(await ubah(jasa.serviceId, { description: null, isPublic: null, isActive: null, sortOrder: null }), 422, 'validation_failed', {
      description: 'invalid_type',
      isPublic: 'invalid_type',
      isActive: 'invalid_type',
      sortOrder: 'invalid_type',
    });
  });

  const KASUS_422: Array<[string, Record<string, unknown>, Record<string, string>]> = [
    ['nama kosong', { name: '' }, { name: 'required' }],
    ['nama hanya spasi', { name: '  ' }, { name: 'required' }],
    ['nama satu huruf', { name: 'A' }, { name: 'too_short' }],
    ['nama 101 karakter', { name: 'n'.repeat(101) }, { name: 'too_long' }],
    ['nama angka', { name: 1 }, { name: 'invalid_type' }],
    ['deskripsi 1001 karakter', { description: 'd'.repeat(1001) }, { description: 'too_long' }],
    ['harga teks', { price: '40000' }, { price: 'invalid_type' }],
    ['harga pecahan', { price: 0.5 }, { price: 'invalid_type' }],
    ['harga negatif', { price: -1 }, { price: 'out_of_range' }],
    ['harga lebih dari 100.000.000', { price: 100000001 }, { price: 'out_of_range' }],
    ['durasi 0', { durationMinutes: 0 }, { durationMinutes: 'out_of_range' }],
    ['durasi 1441', { durationMinutes: 1441 }, { durationMinutes: 'out_of_range' }],
    ['durasi teks', { durationMinutes: '' }, { durationMinutes: 'invalid_type' }],
    ['isPublic teks', { isPublic: 'false' }, { isPublic: 'invalid_type' }],
    ['isActive angka', { isActive: 1 }, { isActive: 'invalid_type' }],
    ['urutan negatif', { sortOrder: -1 }, { sortOrder: 'out_of_range' }],
    ['urutan 100.001', { sortOrder: 100001 }, { sortOrder: 'out_of_range' }],
    [
      'semua field salah sekaligus',
      { name: 'x', description: 5, price: -5, durationMinutes: 2000, isPublic: 0, isActive: 'ya', sortOrder: 0.5 },
      { name: 'too_short', description: 'invalid_type', price: 'out_of_range', durationMinutes: 'out_of_range', isPublic: 'invalid_type', isActive: 'invalid_type', sortOrder: 'invalid_type' },
    ],
  ];

  it.each(KASUS_422)('%s → 422, tanpa perubahan', async (_nama, isi, fields) => {
    const jasa = await buatJasa(pemilik.token);

    harapGalat(await ubah(jasa.serviceId, { ...isi }), 422, 'validation_failed', fields);
    harapSetara(await jasaApi(jasa.serviceId), jasa);
  });

  it('validasi (422) lebih dulu dari nama kembar (409)', async () => {
    const lain = await buatJasa(pemilik.token);
    const jasa = await buatJasa(pemilik.token);

    harapGalat(await ubah(jasa.serviceId, { name: lain.name, sortOrder: -1 }), 422, 'validation_failed', { sortOrder: 'out_of_range' });
  });

  it('jasa tidak ada, UUID huruf besar, atau bukan UUID → 404, sebelum 422', async () => {
    const jasa = await buatJasa(pemilik.token);

    harapGalat(await ubah(randomUUID(), { price: 1 }), 404, 'not_found');
    harapGalat(await ubah(jasa.serviceId.toUpperCase(), { price: 1 }), 404, 'not_found');
    harapGalat(await ubah('bukan-uuid', { price: 1 }), 404, 'not_found');
    harapGalat(await ubah(randomUUID(), { price: 'salah' }), 404, 'not_found');
  });

  it('kasir dan mekanik → 403 tanpa perubahan, juga untuk jasa yang tidak ada (403 sebelum 404)', async () => {
    const jasa = await buatJasa(pemilik.token);

    harapGalat(await ubah(jasa.serviceId, { price: 1 }, kasir.token), 403, 'forbidden');
    harapGalat(await ubah(jasa.serviceId, { isActive: false }, mekanik.token), 403, 'forbidden');
    harapGalat(await ubah(randomUUID(), { price: 'salah' }, kasir.token), 403, 'forbidden');
    harapSetara(await jasaApi(jasa.serviceId), jasa);
  });

  it('urutan: 413 → 400 → 401 → 403 → 404', async () => {
    const id = randomUUID();
    const path = `/api/services/${id}`;

    harapGalat(await api.patch(path, { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.patch(path, { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.patch(path, { token: kasir.token, mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.patch(path, { token: pemilik.token, mentah: '[]' }), 400, 'bad_request');
    harapGalat(await api.patch(path, { token: pemilik.token, mentah: '' }), 400, 'bad_request');
    harapGalat(await api.patch(path, { token: pemilik.token, biner: badanUtf8Rusak() }), 400, 'bad_request');
    harapGalat(await ubah(id, {}, undefined), 401, 'unauthenticated');
    harapGalat(await ubah(id, {}, tokenAcak()), 401, 'unauthenticated');
    harapGalat(await ubah(id, {}, mekanik.token), 403, 'forbidden');
    harapGalat(await ubah(id, {}), 404, 'not_found');
  });

  it('dua PATCH serentak dengan field berbeda sama-sama bertahan', async () => {
    const semua = await Promise.all(Array.from({ length: 3 }, () => buatJasa(pemilik.token)));

    const hasil = await Promise.all(
      semua.flatMap((j, i) => [ubah(j.serviceId, { price: 10000 + i }), ubah(j.serviceId, { description: `Deskripsi ${i}` }), ubah(j.serviceId, { sortOrder: 50 + i })]),
    );

    expect(hasil.map((r) => r.status)).toEqual(Array(9).fill(200));
    for (const [i, j] of semua.entries()) {
      expect(await jasaApi(j.serviceId)).toMatchObject({ price: 10000 + i, description: `Deskripsi ${i}`, sortOrder: 50 + i, name: j.name });
    }
  });

  it('dua jasa diubah serentak ke nama yang sama → satu 200 dan satu 409 service_name_taken', async () => {
    const x = await buatJasa(pemilik.token);
    const y = await buatJasa(pemilik.token);
    const nama = namaUnik('Rebut');

    const hasil = await Promise.all([ubah(x.serviceId, { name: nama }), ubah(y.serviceId, { name: nama.toLowerCase() })]);

    expect(hasil.map((r) => r.status).sort()).toEqual([200, 409]);
    harapGalat(hasil.find((r) => r.status === 409) as Respons, 409, 'service_name_taken');
  });
});

describe('perubahan jasa dan data yang sudah ada', () => {
  it('nama dan harga yang diubah tidak mengubah item SPK yang sudah ada (disalin)', async () => {
    const jasa = await buatJasa(pemilik.token, { price: 35000 });
    const { kendaraan } = await buatPelangganDenganKendaraan(kasir.token);
    const spk = await buatSpk(kasir.token, kendaraan.vehicleId);
    const sebelum = await tambahJasa(kasir.token, spk.number, jasa.serviceId, 2);

    harapStatus(await ubah(jasa.serviceId, { name: namaUnik('Nama Baru'), price: 99000 }), 200);

    const sesudah = await detailSpk(kasir.token, spk.number);
    expect(sesudah.items).toEqual(sebelum.items);
    expect(sesudah.items[0]).toMatchObject({ name: jasa.name, price: 35000, quantity: 2, subtotal: 70000 });
    expect(sesudah.total).toBe(sebelum.total);
  });

  it('nama yang diubah tidak mengubah salinan nama jasa di booking yang sudah ada (staf dan publik)', async () => {
    const jasa = await buatJasa(pemilik.token);
    const { bookingId, bookingToken } = await buatBookingPublik({ serviceId: jasa.serviceId });

    harapStatus(await ubah(jasa.serviceId, { name: namaUnik('Nama Lain'), price: 1 }), 200);

    expect((await bookingStaf(kasir.token, bookingId)).service).toEqual({ serviceId: jasa.serviceId, name: jasa.name });
    const publik = await api.get(`/api/public/bookings/${bookingToken}`);
    harapStatus(publik, 200);
    expect(publik.body.data.serviceName).toBe(jasa.name);
  });

  it('booking menunggu dengan jasa yang lalu dinonaktifkan tetap sah; saat dijadikan SPK jasa itu tidak menjadi item', async () => {
    const jasa = await buatJasa(pemilik.token);
    const { bookingId, bookingToken } = await buatBookingPublik({ serviceId: jasa.serviceId });

    harapStatus(await ubah(jasa.serviceId, { isActive: false }), 200);

    expect((await bookingStaf(kasir.token, bookingId)).status).toBe('PENDING');
    harapStatus(await api.get(`/api/public/bookings/${bookingToken}`), 200);
    const { workOrder } = await jadikanSpk(kasir.token, bookingId);
    expect(workOrder.items).toEqual([]);
    expect(workOrder.total).toBe(0);
  });

  it('jasa tidak pernah dihapus: sesudah dinonaktifkan barisnya tetap ada dan tetap tampil di daftar staf', async () => {
    const jasa = await buatJasa(pemilik.token);

    harapStatus(await ubah(jasa.serviceId, { isActive: false, isPublic: false }), 200);

    expect(await bacaSatu('SELECT is_active FROM services WHERE service_id = ?', [jasa.serviceId])).toBeDefined();
    expect(await jasaApi(jasa.serviceId)).toMatchObject({ isActive: false, isPublic: false });
  });
});
