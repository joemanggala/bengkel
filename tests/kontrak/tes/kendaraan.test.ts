// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// POST /api/customers/{customerId}/vehicles dan PATCH /api/vehicles/{vehicleId}: normalisasi plat
// beserta bentuk tampilannya (tabel PlatMasukan di spec), plate_taken, validasi tiap field, aturan
// null, urutan pemeriksaan, dan peran. Pencarian plat dan riwayat servis ada di
// kendaraan-cari.test.ts.

import { beforeAll, describe, expect, it } from 'vitest';
import { buatKasir, buatMekanik, buatPelanggan, buatPemilik, buatSpk, detailSpk, platUnik, tambahKendaraan, type SesiStaf } from '../src/data';
import { jumlahBaris } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { JSON_RUSAK, jsonLebihDariSatuMib } from './pembantu-fondasi';
import { detailPelanggan, ID_TAK_ADA, idDianggapTakAda, kirimTambahKendaraan, kirimUbahKendaraan, tanpaUpdatedAt, teksKodePoin, ubahKendaraan } from './pembantu-pelanggan';

let pemilik: SesiStaf;
let kasir: SesiStaf;
let mekanik: SesiStaf;
let pelanggan: any;

beforeAll(async () => {
  pemilik = await buatPemilik();
  kasir = await buatKasir();
  mekanik = await buatMekanik();
  pelanggan = await buatPelanggan(kasir.token);
});

const tambah = (json: unknown, token: string | null = kasir.token, customerId: string = pelanggan.customerId) =>
  kirimTambahKendaraan(token, customerId, json);

const isian = (ubah: Record<string, unknown> = {}) => ({ type: 'MOTOR', plate: platUnik(), brand: 'Honda', ...ubah });

describe('POST /api/customers/{customerId}/vehicles: plat (PlatMasukan)', () => {
  it('contoh permintaan spec: b1234xyz → plat "B 1234 XYZ", kunci "B1234XYZ"; bentuk lain plat yang sama → 409 plate_taken', async () => {
    const res = await tambah({ type: 'MOTOR', plate: 'b1234xyz', brand: 'Honda', model: 'Vario 125', year: 2021, color: 'Hitam' });

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({
      customerId: pelanggan.customerId,
      type: 'MOTOR',
      plate: 'B 1234 XYZ',
      plateKey: 'B1234XYZ',
      brand: 'Honda',
      model: 'Vario 125',
      year: 2021,
      color: 'Hitam',
    });
    expect((await detailPelanggan(kasir.token, pelanggan.customerId)).vehicles.map((v: any) => v.vehicleId)).toContain(res.body.data.vehicleId);

    const lain = await buatPelanggan(kasir.token);
    // Contoh tabel spec dengan kunci B1234XYZ, ditambah titik dan baris baru di ujung; milik
    // pelanggan ini sendiri maupun pelanggan lain.
    for (const plate of [' B 1234  XYZ ', 'B-1234-XYZ', 'b.1234.xyz', '\tB1234XYZ\r\n']) {
      harapGalat(await tambah(isian({ plate })), 409, 'plate_taken');
      harapGalat(await tambah(isian({ plate }), kasir.token, lain.customerId), 409, 'plate_taken');
    }
    expect(await jumlahBaris('vehicles', 'plate_key = ?', ['B1234XYZ'])).toBe(1);
  });

  it.each([
    ['ab 12 c', 'AB12C', 'AB 12 C'],
    ['D 1', 'D1', 'D 1'],
    ['RI1', 'RI1', 'RI 1'],
    ['B 1234 XYZ 5', 'B1234XYZ5', 'B1234XYZ5'],
    ['ABCDE', 'ABCDE', 'ABCDE'],
    ['b1a2', 'B1A2', 'B1A2'],
    ['zz 98765', 'ZZ98765', 'ZZ 98765'],
    ['ABCDEFGHIJKL', 'ABCDEFGHIJKL', 'ABCDEFGHIJKL'],
  ])('"%s" → kunci %s, tampilan "%s"', async (plate, plateKey, tampil) => {
    const res = await tambah(isian({ plate }));

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ plate: tampil, plateKey });
  });

  it.each([
    ['1234 AB (diawali angka)', '1234 AB', 'invalid_format'],
    ['B (satu huruf)', 'B', 'too_short'],
    ['B 1234 ABCDEFGH (13 karakter)', 'B 1234 ABCDEFGH', 'too_long'],
    ['B/1234 (garis miring)', 'B/1234', 'invalid_format'],
    ['tab di tengah', 'B\t1234', 'invalid_format'],
    ['huruf non-ASCII', 'É 1234', 'invalid_format'],
    ['huruf kecil non-ASCII tidak dibesarkan', 'bß12', 'invalid_format'],
    ['format dinilai sebelum panjang: 13 angka', '1234567890123', 'invalid_format'],
    ['format dinilai sebelum panjang: garis miring di plat 13 karakter', 'B/12345678901', 'invalid_format'],
    ['kosong', '', 'required'],
    ['hanya spasi, titik, dan tanda hubung', ' .- ', 'required'],
    ['null', null, 'required'],
    ['angka JSON', 1234, 'invalid_type'],
  ])('%s → 422 plate: %s', async (_judul, plate, kode) => {
    const sebelum = await jumlahBaris('vehicles');

    harapGalat(await tambah(isian({ plate })), 422, 'validation_failed', { plate: kode as string });
    expect(await jumlahBaris('vehicles')).toBe(sebelum);
  });
});

describe('POST /api/customers/{customerId}/vehicles: field lain', () => {
  it('hanya type, plate, brand: model dan color bawaan "", year bawaan null; CAR diterima; teks dipangkas', async () => {
    const plate = platUnik('D');
    const res = await tambah({ type: 'CAR', plate, brand: '  Toyota \n' }, pemilik.token);

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ type: 'CAR', plate, brand: 'Toyota', model: '', year: null, color: '' });
  });

  it('model dan color dipangkas; year null sah; batas sah: brand dan model 50, color 30 code point, year 1900 dan 2100', async () => {
    const a = await tambah(isian({ brand: teksKodePoin(50), model: teksKodePoin(50), color: teksKodePoin(30), year: 1900 }));
    const b = await tambah(isian({ model: ' \tBeat ', color: '  Merah\r\n', year: 2100 }));
    const c = await tambah(isian({ year: null }));
    const d = await api.post(`/api/customers/${pelanggan.customerId}/vehicles`, {
      token: kasir.token,
      mentah: JSON.stringify(isian()).replace('}', ',"year":2021.0}'),
    });

    for (const r of [a, b, c, d]) {
      harapStatus(r, 201);
    }
    expect(a.body.data).toMatchObject({ brand: teksKodePoin(50), model: teksKodePoin(50), color: teksKodePoin(30), year: 1900 });
    expect(b.body.data).toMatchObject({ model: 'Beat', color: 'Merah', year: 2100 });
    expect(c.body.data.year).toBeNull();
    expect(d.body.data.year).toBe(2021);
  });

  it('field yang tidak dikenal diabaikan: customerId dan plateKey dari badan tidak berlaku', async () => {
    const lain = await buatPelanggan(kasir.token);

    const res = await tambah(isian({ plate: 'kk 77 xy', customerId: lain.customerId, plateKey: 'ZZZ', vehicleId: ID_TAK_ADA }));

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ customerId: pelanggan.customerId, plateKey: 'KK77XY', plate: 'KK 77 XY' });
    expect(res.body.data.vehicleId).not.toBe(ID_TAK_ADA);
  });

  it.each([
    ['badan kosong', null, { type: 'required', plate: 'required', brand: 'required' }],
    ['type kosong', { type: '' }, { type: 'required' }],
    ['type null', { type: null }, { type: 'required' }],
    ['type hanya spasi (tidak dipangkas)', { type: '  ' }, { type: 'invalid_format' }],
    ['type huruf kecil', { type: 'motor' }, { type: 'invalid_format' }],
    ['type TRUCK', { type: 'TRUCK' }, { type: 'invalid_format' }],
    ['type berspasi', { type: ' MOTOR' }, { type: 'invalid_format' }],
    ['type angka', { type: 1 }, { type: 'invalid_type' }],
    ['brand hanya spasi', { brand: ' \t ' }, { brand: 'required' }],
    ['brand null', { brand: null }, { brand: 'required' }],
    ['brand 51 code point', { brand: teksKodePoin(51) }, { brand: 'too_long' }],
    ['brand angka', { brand: 5 }, { brand: 'invalid_type' }],
    ['model null', { model: null }, { model: 'invalid_type' }],
    ['model 51', { model: 'm'.repeat(51) }, { model: 'too_long' }],
    ['color null', { color: null }, { color: 'invalid_type' }],
    ['color 31 code point', { color: teksKodePoin(31) }, { color: 'too_long' }],
    ['year teks', { year: '2021' }, { year: 'invalid_type' }],
    ['year pecahan', { year: 2021.5 }, { year: 'invalid_type' }],
    ['year boolean', { year: true }, { year: 'invalid_type' }],
    ['year 1899', { year: 1899 }, { year: 'out_of_range' }],
    ['year 2101', { year: 2101 }, { year: 'out_of_range' }],
    ['semua sekaligus', { type: 'motor', plate: 'B', brand: '', model: 1, year: 1800, color: null }, { type: 'invalid_format', plate: 'too_short', brand: 'required', model: 'invalid_type', year: 'out_of_range', color: 'invalid_type' }],
  ])('%s → 422 tanpa membuat kendaraan', async (_judul, ubah, fields) => {
    const sebelum = await jumlahBaris('vehicles');
    const json = ubah === null ? {} : isian(ubah);

    harapGalat(await tambah(json), 422, 'validation_failed', fields);
    expect(await jumlahBaris('vehicles')).toBe(sebelum);
  });

  it('year melebihi 2^53−1 (1e400) → out_of_range', async () => {
    const res = await api.post(`/api/customers/${pelanggan.customerId}/vehicles`, {
      token: kasir.token,
      mentah: JSON.stringify(isian()).replace('}', ',"year":1e400}'),
    });

    harapGalat(res, 422, 'validation_failed', { year: 'out_of_range' });
  });

  it('urutan pemeriksaan: 413 → 400 → 401 → 403 → 404 → 422 → 409', async () => {
    const ada = await tambahKendaraan(kasir.token, pelanggan.customerId);
    const path = `/api/customers/${ID_TAK_ADA}/vehicles`;

    harapGalat(await api.post(path, { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.post(path, { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.post(path, { mentah: 'null', token: mekanik.token }), 400, 'bad_request');
    harapGalat(await tambah({}, null, ID_TAK_ADA), 401, 'unauthenticated');
    harapGalat(await tambah({}, mekanik.token, ID_TAK_ADA), 403, 'forbidden');
    harapGalat(await tambah(isian(), mekanik.token), 403, 'forbidden');
    for (const id of idDianggapTakAda(pelanggan.customerId)) {
      harapGalat(await tambah({}, kasir.token, id), 404, 'not_found');
    }
    harapGalat(await tambah(isian({ plate: ada.plate, brand: '' })), 422, 'validation_failed', { brand: 'required' });
    harapGalat(await tambah(isian({ plate: ada.plateKey })), 409, 'plate_taken');
  });
});

describe('PATCH /api/vehicles/{vehicleId}', () => {
  const ubah = (id: string, json: unknown, token: string | null = kasir.token) => kirimUbahKendaraan(token, id, json);

  it('perubahan sebagian: plat baru dinormalisasi (kunci dan tampilan), field lain tetap', async () => {
    const v = await tambahKendaraan(kasir.token, pelanggan.customerId, { year: 2019, color: 'Hitam' });

    const res = await ubah(v.vehicleId, { plate: ' f-4321-ab ', color: '  Merah ' });

    harapStatus(res, 200);
    expect(tanpaUpdatedAt(res.body.data)).toEqual(tanpaUpdatedAt({ ...v, plate: 'F 4321 AB', plateKey: 'F4321AB', color: 'Merah' }));
    const diPelanggan = (await detailPelanggan(kasir.token, pelanggan.customerId)).vehicles.find((x: any) => x.vehicleId === v.vehicleId);
    expect(diPelanggan).toEqual(res.body.data);
  });

  it('{} dan field yang tidak dikenal → 200 tanpa perubahan; pemilik kendaraan tidak bisa diganti', async () => {
    const v = await tambahKendaraan(kasir.token, pelanggan.customerId);
    const lain = await buatPelanggan(kasir.token);

    const kosong = await ubah(v.vehicleId, {});
    const asing = await ubah(v.vehicleId, { customerId: lain.customerId, plateKey: 'ZZZ', vehicleId: ID_TAK_ADA }, pemilik.token);

    for (const res of [kosong, asing]) {
      harapStatus(res, 200);
      expect(tanpaUpdatedAt(res.body.data)).toEqual(tanpaUpdatedAt(v));
    }
    expect((await detailPelanggan(kasir.token, lain.customerId)).vehicles).toEqual([]);
  });

  it('year null mengosongkan tahun; model dan color boleh dikosongkan; type boleh diganti', async () => {
    const v = await tambahKendaraan(kasir.token, pelanggan.customerId, { year: 2021, color: 'Hitam' });

    const res = await ubah(v.vehicleId, { year: null, model: '', color: '  ', type: 'CAR' });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ year: null, model: '', color: '', type: 'CAR' });
  });

  it('plat miliknya sendiri dalam bentuk lain bukan bentrok; plat kendaraan lain (pelanggan mana pun) → 409 plate_taken tanpa perubahan', async () => {
    const v = await tambahKendaraan(kasir.token, pelanggan.customerId);
    const punyaSendiri = await tambahKendaraan(kasir.token, pelanggan.customerId);
    const lain = await tambahKendaraan(kasir.token, (await buatPelanggan(kasir.token)).customerId);

    const sama = await ubah(v.vehicleId, { plate: v.plateKey.toLowerCase() });
    harapStatus(sama, 200);
    expect(sama.body.data).toMatchObject({ plate: v.plate, plateKey: v.plateKey });

    for (const target of [punyaSendiri, lain]) {
      harapGalat(await ubah(v.vehicleId, { plate: target.plate.replaceAll(' ', '-'), brand: 'Yamaha' }), 409, 'plate_taken');
    }
    expect(tanpaUpdatedAt((await detailPelanggan(kasir.token, pelanggan.customerId)).vehicles.find((x: any) => x.vehicleId === v.vehicleId))).toEqual(
      tanpaUpdatedAt(v),
    );
  });

  it.each([
    ['type null', { type: null }, { type: 'required' }],
    ['plate null', { plate: null }, { plate: 'required' }],
    ['brand null', { brand: null }, { brand: 'required' }],
    ['model null', { model: null }, { model: 'invalid_type' }],
    ['color null', { color: null }, { color: 'invalid_type' }],
    ['type kosong', { type: '' }, { type: 'required' }],
    ['type TRUCK', { type: 'TRUCK' }, { type: 'invalid_format' }],
    ['type huruf kecil', { type: 'motor' }, { type: 'invalid_format' }],
    ['type hanya spasi (tidak dipangkas)', { type: '  ' }, { type: 'invalid_format' }],
    ['type berspasi', { type: ' CAR' }, { type: 'invalid_format' }],
    ['plate diawali angka', { plate: '1234 AB' }, { plate: 'invalid_format' }],
    ['plate 13 karakter', { plate: 'B 1234 ABCDEFGH' }, { plate: 'too_long' }],
    ['brand kosong', { brand: '  ' }, { brand: 'required' }],
    ['year 2101', { year: 2101 }, { year: 'out_of_range' }],
    ['year teks', { year: '2020' }, { year: 'invalid_type' }],
    ['semua sekaligus', { type: 1, plate: null, brand: 'b'.repeat(51), color: 5 }, { type: 'invalid_type', plate: 'required', brand: 'too_long', color: 'invalid_type' }],
  ])('%s → 422 tanpa perubahan', async (_judul, json, fields) => {
    const v = await tambahKendaraan(kasir.token, pelanggan.customerId);

    harapGalat(await ubah(v.vehicleId, json), 422, 'validation_failed', fields);
    const sekarang = (await detailPelanggan(kasir.token, pelanggan.customerId)).vehicles.find((x: any) => x.vehicleId === v.vehicleId);
    expect(tanpaUpdatedAt(sekarang)).toEqual(tanpaUpdatedAt(v));
  });

  it('urutan pemeriksaan: 413 → 400 → 401 → 403 → 404 → 422 → 409', async () => {
    const v = await tambahKendaraan(kasir.token, pelanggan.customerId);
    const lain = await tambahKendaraan(kasir.token, pelanggan.customerId);
    const path = `/api/vehicles/${ID_TAK_ADA}`;

    harapGalat(await api.patch(path, { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.patch(path, { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.patch(path, { mentah: '"teks"', token: mekanik.token }), 400, 'bad_request');
    harapGalat(await ubah(ID_TAK_ADA, { brand: '' }, null), 401, 'unauthenticated');
    harapGalat(await ubah(ID_TAK_ADA, { brand: '' }, mekanik.token), 403, 'forbidden');
    harapGalat(await ubah(v.vehicleId, { color: 'Biru' }, mekanik.token), 403, 'forbidden');
    for (const id of idDianggapTakAda(v.vehicleId)) {
      harapGalat(await ubah(id, { brand: '' }), 404, 'not_found');
    }
    harapGalat(await ubah(v.vehicleId, { plate: lain.plate, brand: '' }), 422, 'validation_failed', { brand: 'required' });
    harapGalat(await ubah(v.vehicleId, { plate: lain.plate }), 409, 'plate_taken');
  });

  it('plat, merek, dan tipe di SPK lama ikut berubah karena SPK membaca data kendaraan saat ini', async () => {
    const v = await tambahKendaraan(kasir.token, pelanggan.customerId);
    const spk = await buatSpk(kasir.token, v.vehicleId);

    await ubahKendaraan(kasir.token, v.vehicleId, { plate: 'g 2468 kl', brand: 'Yamaha', model: 'NMAX', year: 2023, color: 'Abu' });

    expect((await detailSpk(kasir.token, spk.number)).vehicle).toEqual({
      vehicleId: v.vehicleId,
      type: 'MOTOR',
      plate: 'G 2468 KL',
      brand: 'Yamaha',
      model: 'NMAX',
      year: 2023,
      color: 'Abu',
    });
  });
});
