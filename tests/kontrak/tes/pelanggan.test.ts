// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// POST /api/customers, GET /api/customers/{customerId}, PATCH /api/customers/{customerId}:
// normalisasi nomor HP (skema NomorHpMasukan, semua contoh di spec), phone_taken, pemangkasan,
// panjang teks dalam code point, aturan null, urutan pemeriksaan, dan peran (mekanik → 403).
// Daftar dan pencarian pelanggan ada di pelanggan-daftar.test.ts.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import {
  bookingStaf,
  buatBookingPublik,
  buatKasir,
  buatMekanik,
  buatPelanggan,
  buatPemilik,
  buatSpk,
  detailSpk,
  jadikanSpk,
  nomorUnik,
  tambahKendaraan,
  type SesiStaf,
} from '../src/data';
import { jumlahBaris } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { JSON_RUSAK, jsonLebihDariSatuMib } from './pembantu-fondasi';
import {
  aturWaktuKendaraan,
  bentukNol,
  detailPelanggan,
  ID_TAK_ADA,
  idDianggapTakAda,
  kirimBuatPelanggan,
  kirimDetailPelanggan,
  kirimUbahPelanggan,
  nomorSepanjang,
  tanpaUpdatedAt,
  teksKodePoin,
  ubahPelanggan,
  urutId,
} from './pembantu-pelanggan';

let pemilik: SesiStaf;
let kasir: SesiStaf;
let mekanik: SesiStaf;

beforeAll(async () => {
  pemilik = await buatPemilik();
  kasir = await buatKasir();
  mekanik = await buatMekanik();
});

const buat = (json: unknown, token: string | null = kasir.token) => kirimBuatPelanggan(token, json);

describe('POST /api/customers: nomor HP (NomorHpMasukan)', () => {
  it('contoh spec "0812-3456-7890" disimpan 6281234567890; "+62 812 3456 7890" dan "6281234567890" adalah nomor yang sama → 409 phone_taken', async () => {
    const res = await buat({ name: 'Budi Santoso', phone: '0812-3456-7890', address: 'Jl. Kenanga 5' });

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ name: 'Budi Santoso', phone: '6281234567890', address: 'Jl. Kenanga 5', notes: '', vehicles: [] });
    for (const phone of ['+62 812 3456 7890', '6281234567890', '0812 3456 7890', '62-812-3456-7890']) {
      harapGalat(await buat({ name: 'Orang Lain', phone }), 409, 'phone_taken');
    }
    expect(await jumlahBaris('customers', 'phone = ?', ['6281234567890'])).toBe(1);
  });

  it('awalan 08, +628, dan 628 dengan spasi dan tanda hubung di mana pun; spasi, tab, CR, LF di ujung dipangkas', async () => {
    const kasus: Array<[(s: string) => string, string]> = [
      [(s) => bentukNol(s), 'tanda hubung'],
      [(s) => `+62 ${s.slice(2, 5)} ${s.slice(5, 9)} ${s.slice(9)}`, '+62 dengan spasi'],
      [(s) => `+${s}`, '+628 rapat'],
      [(s) => s, '628 rapat'],
      [(s) => `0${s.slice(2)}`, '08 rapat'],
      [(s) => ` -0${s.slice(2, 4)}- -${s.slice(4)}- `, 'spasi dan tanda hubung berderet'],
      [(s) => `\t\r\n 0${s.slice(2)} \n\t`, 'tab, CR, LF di ujung'],
    ];
    for (const [bentuk, judul] of kasus) {
      const seragam = nomorUnik();
      const res = await buat({ name: 'Budi Santoso', phone: bentuk(seragam) });
      expect(res.status, judul).toBe(201);
      expect(res.body.data.phone, judul).toBe(seragam);
    }
  });

  it('panjang bentuk seragam: 10 dan 15 digit sah', async () => {
    for (const panjang of [10, 15]) {
      const seragam = nomorSepanjang(panjang);
      const res = await buat({ name: 'Budi Santoso', phone: bentukNol(seragam) });

      harapStatus(res, 201);
      expect(res.body.data.phone).toBe(seragam);
    }
  });

  it.each([
    ['08123456 (contoh spec, 9 digit)', '08123456', 'too_short'],
    ['0812345678901234 (contoh spec, 17 digit)', '0812345678901234', 'too_long'],
    ['16 digit', '081234567890123', 'too_long'],
    ['021-555-1234 (contoh spec, bukan 08…)', '021-555-1234', 'invalid_format'],
    ['(0812) 3456 (contoh spec)', '(0812) 3456', 'invalid_format'],
    ['+08…', '+081234567890', 'invalid_format'],
    ['6208…', '6208123456789', 'invalid_format'],
    ['huruf', '0812abc67890', 'invalid_format'],
    ['nomor luar negeri', '+6012345678', 'invalid_format'],
    ['tab di tengah', '0812\t34567890', 'invalid_format'],
    ['NBSP di tengah', '0812 34567890', 'invalid_format'],
    ['format dinilai sebelum panjang: 2 digit bukan 08', '12', 'invalid_format'],
    ['format dinilai sebelum panjang: 20 digit bukan 08', '02123456789012345678', 'invalid_format'],
    ['kosong', '', 'required'],
    ['hanya spasi dan tanda hubung', ' - - ', 'required'],
    ['hanya tab dan baris baru', '\t\r\n', 'required'],
    ['null', null, 'required'],
    ['angka JSON', 81234567890, 'invalid_type'],
    ['larik', ['081234567890'], 'invalid_type'],
  ])('%s → 422 phone: %s', async (_judul, phone, kode) => {
    const sebelum = await jumlahBaris('customers');

    harapGalat(await buat({ name: 'Budi Santoso', phone }), 422, 'validation_failed', { phone: kode as string });
    expect(await jumlahBaris('customers')).toBe(sebelum);
  });
});

describe('POST /api/customers: field lain', () => {
  it('201: nama, alamat, dan catatan dipangkas; pergantian baris di tengah alamat dipertahankan; vehicles kosong', async () => {
    const phone = nomorUnik();
    const res = await buat({ name: ' \t Ibu Sari \r\n', phone, address: '\n Jl. Kenanga 5\nRT 02 \t', notes: '  Langganan  ' });

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ name: 'Ibu Sari', phone, address: 'Jl. Kenanga 5\nRT 02', notes: 'Langganan', vehicles: [] });
    harapSetara(await detailPelanggan(kasir.token, res.body.data.customerId), res.body.data);
  });

  it('alamat dan catatan opsional, bawaan string kosong; NBSP di ujung nama tidak dipangkas', async () => {
    const res = await buat({ name: ' Budi ', phone: nomorUnik() });

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ name: ' Budi ', address: '', notes: '', vehicles: [] });
  });

  it('pemilik juga boleh; field yang tidak dikenal diabaikan', async () => {
    const res = await buat({ name: 'Budi Santoso', phone: nomorUnik(), customerId: ID_TAK_ADA, vehicles: [{ plate: 'B 1 A' }], createdAt: '2000-01-01T00:00:00Z' }, pemilik.token);

    harapStatus(res, 201);
    expect(res.body.data.customerId).not.toBe(ID_TAK_ADA);
    expect(res.body.data.vehicles).toEqual([]);
    expect(await jumlahBaris('vehicles', 'customer_id = ?', [res.body.data.customerId])).toBe(0);
  });

  it('batas panjang dalam code point: nama 2 dan 100, alamat dan catatan 500 → sah', async () => {
    const pendek = await buat({ name: 'Al', phone: nomorUnik() });
    const panjang = await buat({ name: teksKodePoin(100), phone: nomorUnik(), address: teksKodePoin(500), notes: teksKodePoin(500) });

    harapStatus(pendek, 201);
    harapStatus(panjang, 201);
    expect(panjang.body.data).toMatchObject({ name: teksKodePoin(100), address: teksKodePoin(500), notes: teksKodePoin(500) });
  });

  it.each([
    // null = badan {} apa adanya, tanpa digabung dengan nama dan nomor sah di bawah.
    ['badan kosong', null, { name: 'required', phone: 'required' }],
    ['name null', { name: null }, { name: 'required' }],
    ['name hanya spasi', { name: ' \t\r\n ' }, { name: 'required' }],
    ['name satu huruf sesudah dipangkas', { name: '  a  ' }, { name: 'too_short' }],
    ['name 101 code point', { name: teksKodePoin(101) }, { name: 'too_long' }],
    ['name angka', { name: 123 }, { name: 'invalid_type' }],
    ['address null', { address: null }, { address: 'invalid_type' }],
    ['address angka', { address: 5 }, { address: 'invalid_type' }],
    ['address 501 code point', { address: teksKodePoin(501) }, { address: 'too_long' }],
    ['notes null', { notes: null }, { notes: 'invalid_type' }],
    ['notes boolean', { notes: true }, { notes: 'invalid_type' }],
    ['notes 501 code point', { notes: teksKodePoin(501) }, { notes: 'too_long' }],
    ['semua sekaligus', { name: 'a', phone: '021', address: null, notes: 'x'.repeat(501) }, { name: 'too_short', phone: 'invalid_format', address: 'invalid_type', notes: 'too_long' }],
  ])('%s → 422 tanpa membuat pelanggan', async (_judul, ubah, fields) => {
    const sebelum = await jumlahBaris('customers');

    const badan = ubah === null ? {} : { name: 'Budi Santoso', phone: nomorUnik(), ...ubah };
    harapGalat(await buat(badan), 422, 'validation_failed', fields);
    expect(await jumlahBaris('customers')).toBe(sebelum);
  });
});

describe('POST /api/customers: urutan pemeriksaan 413 → 400 → 401 → 403 → 422 → 409', () => {
  it('badan lebih dari 1 MiB → 413 walau tanpa token', async () => {
    harapGalat(await api.post('/api/customers', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
  });

  it('JSON rusak atau bukan objek → 400, walau tanpa token atau dengan token mekanik', async () => {
    for (const mentah of [JSON_RUSAK, '[]', 'null', '"teks"', '12', 'true', '']) {
      harapGalat(await api.post('/api/customers', { mentah }), 400, 'bad_request');
      harapGalat(await api.post('/api/customers', { mentah, token: mekanik.token }), 400, 'bad_request');
    }
  });

  it('tanpa token → 401; mekanik → 403 walau badannya tidak sah; tidak sah + nomor dipakai → 422; nomor dipakai → 409', async () => {
    const ada = await buatPelanggan(kasir.token);

    harapGalat(await buat({ name: 'a', phone: '' }, null), 401, 'unauthenticated');
    harapGalat(await buat({ name: 'Budi Santoso', phone: nomorUnik() }, 'x'.repeat(43)), 401, 'unauthenticated');
    harapGalat(await buat({ name: 'a', phone: '' }, mekanik.token), 403, 'forbidden');
    harapGalat(await buat({ name: 'Budi Santoso', phone: nomorUnik() }, mekanik.token), 403, 'forbidden');
    harapGalat(await buat({ name: 'a', phone: ada.phone }), 422, 'validation_failed', { name: 'too_short' });
    harapGalat(await buat({ name: 'Budi Santoso', phone: ada.phone }, pemilik.token), 409, 'phone_taken');
  });
});

describe('GET /api/customers/{customerId}', () => {
  it('pelanggan beserta semua kendaraannya, urut createdAt naik lalu vehicleId naik', async () => {
    const p = await buatPelanggan(kasir.token);
    const v: any[] = [];
    for (let i = 0; i < 3; i += 1) {
      v.push(await tambahKendaraan(kasir.token, p.customerId));
    }
    // v[0] paling baru; v[1] dan v[2] berwaktu sama sehingga dipisahkan vehicleId naik.
    await aturWaktuKendaraan(v[0].vehicleId, '2026-03-10 12:00:00.000');
    await aturWaktuKendaraan(v[1].vehicleId, '2026-03-10 09:00:00.000');
    await aturWaktuKendaraan(v[2].vehicleId, '2026-03-10 09:00:00.000');
    const kembar = [v[1].vehicleId, v[2].vehicleId].sort(urutId);

    const res = await kirimDetailPelanggan(kasir.token, p.customerId);

    harapStatus(res, 200);
    expect(res.body.data.vehicles.map((x: any) => x.vehicleId)).toEqual([...kembar, v[0].vehicleId]);
    harapSetara(tanpaUpdatedAt(res.body.data), { ...tanpaUpdatedAt(p), vehicles: res.body.data.vehicles });
    const v0 = res.body.data.vehicles.find((x: any) => x.vehicleId === v[0].vehicleId);
    expect({ ...v0, createdAt: null }).toEqual({ ...v[0], createdAt: null });
  });

  it('pemilik juga boleh; mekanik → 403; tanpa token → 401', async () => {
    const p = await buatPelanggan(kasir.token);

    harapStatus(await kirimDetailPelanggan(pemilik.token, p.customerId), 200);
    harapGalat(await kirimDetailPelanggan(mekanik.token, p.customerId), 403, 'forbidden');
    harapGalat(await kirimDetailPelanggan(null, p.customerId), 401, 'unauthenticated');
  });

  it('tidak ada, UUID huruf besar, atau bukan UUID → 404; urutan 401 → 403 → 404', async () => {
    const p = await buatPelanggan(kasir.token);

    for (const id of idDianggapTakAda(p.customerId)) {
      harapGalat(await kirimDetailPelanggan(kasir.token, id), 404, 'not_found');
    }
    harapGalat(await kirimDetailPelanggan(null, ID_TAK_ADA), 401, 'unauthenticated');
    harapGalat(await kirimDetailPelanggan(mekanik.token, ID_TAK_ADA), 403, 'forbidden');
  });
});

describe('PATCH /api/customers/{customerId}', () => {
  const ubah = (id: string, json: unknown, token: string | null = kasir.token) => kirimUbahPelanggan(token, id, json);

  it('perubahan sebagian: hanya field yang dikirim berubah; dipangkas dan dinormalisasi seperti saat membuat', async () => {
    const p = await buatPelanggan(kasir.token, { address: 'Jl. Lama 1', notes: 'Catatan lama' });
    const baru = nomorUnik();

    const res = await ubah(p.customerId, { phone: ` +62 ${baru.slice(2)} `, notes: '  Minta dihubungi dulu  ' });

    harapStatus(res, 200);
    expect(tanpaUpdatedAt(res.body.data)).toEqual(tanpaUpdatedAt({ ...p, phone: baru, notes: 'Minta dihubungi dulu' }));
    harapSetara(await detailPelanggan(kasir.token, p.customerId), res.body.data);
  });

  it('{} dan field yang tidak dikenal → 200 tanpa perubahan; vehicles tetap', async () => {
    const p = await buatPelanggan(kasir.token);
    const v = await tambahKendaraan(kasir.token, p.customerId);
    const sebelum = await detailPelanggan(kasir.token, p.customerId);

    const kosong = await ubah(p.customerId, {});
    const asing = await ubah(p.customerId, { customerId: ID_TAK_ADA, vehicles: [], createdAt: '2000-01-01T00:00:00Z', bebas: 1 });

    for (const res of [kosong, asing]) {
      harapStatus(res, 200);
      expect(tanpaUpdatedAt(res.body.data)).toEqual(tanpaUpdatedAt(sebelum));
    }
    expect(asing.body.data.vehicles.map((x: any) => x.vehicleId)).toEqual([v.vehicleId]);
  });

  it('alamat dan catatan boleh dikosongkan dengan ""; nomor miliknya sendiri dalam bentuk lain bukan bentrok', async () => {
    const p = await buatPelanggan(kasir.token, { address: 'Jl. Kenanga 5', notes: 'Langganan' });

    const res = await ubah(p.customerId, { address: '', notes: '   ', phone: bentukNol(p.phone) }, pemilik.token);

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ address: '', notes: '', phone: p.phone });
  });

  it('nomor yang dipakai pelanggan lain (bentuk apa pun) → 409 phone_taken, data tidak berubah', async () => {
    const a = await buatPelanggan(kasir.token);
    const b = await buatPelanggan(kasir.token);

    harapGalat(await ubah(b.customerId, { phone: bentukNol(a.phone), name: 'Nama Baru' }), 409, 'phone_taken');
    expect((await detailPelanggan(kasir.token, b.customerId)).name).toBe(b.name);
  });

  it.each([
    ['name null', { name: null }, { name: 'required' }],
    ['phone null', { phone: null }, { phone: 'required' }],
    ['address null', { address: null }, { address: 'invalid_type' }],
    ['notes null', { notes: null }, { notes: 'invalid_type' }],
    ['name kosong', { name: '  ' }, { name: 'required' }],
    ['name satu huruf', { name: 'a' }, { name: 'too_short' }],
    ['name 101 code point', { name: teksKodePoin(101) }, { name: 'too_long' }],
    ['phone terlalu pendek', { phone: '08123456' }, { phone: 'too_short' }],
    ['phone bukan 08', { phone: '021-555-1234' }, { phone: 'invalid_format' }],
    ['phone angka', { phone: 81234567890 }, { phone: 'invalid_type' }],
    ['address 501', { address: 'a'.repeat(501) }, { address: 'too_long' }],
    ['notes angka', { notes: 1 }, { notes: 'invalid_type' }],
    ['semua sekaligus', { name: null, phone: '(0812)', address: 7, notes: teksKodePoin(501) }, { name: 'required', phone: 'invalid_format', address: 'invalid_type', notes: 'too_long' }],
  ])('%s → 422 tanpa perubahan', async (_judul, json, fields) => {
    const p = await buatPelanggan(kasir.token);

    harapGalat(await ubah(p.customerId, json), 422, 'validation_failed', fields);
    expect(tanpaUpdatedAt(await detailPelanggan(kasir.token, p.customerId))).toEqual(tanpaUpdatedAt(p));
  });

  it('urutan pemeriksaan: 413 → 400 → 401 → 403 → 404 → 422 → 409', async () => {
    const a = await buatPelanggan(kasir.token);
    const b = await buatPelanggan(kasir.token);
    const path = `/api/customers/${ID_TAK_ADA}`;

    harapGalat(await api.patch(path, { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.patch(path, { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.patch(path, { mentah: '[]', token: mekanik.token }), 400, 'bad_request');
    harapGalat(await ubah(ID_TAK_ADA, { name: 'a' }, null), 401, 'unauthenticated');
    harapGalat(await ubah(ID_TAK_ADA, { name: 'a' }, mekanik.token), 403, 'forbidden');
    harapGalat(await ubah(b.customerId, { name: 'Budi' }, mekanik.token), 403, 'forbidden');
    for (const id of idDianggapTakAda(b.customerId)) {
      harapGalat(await ubah(id, { name: 'a' }), 404, 'not_found');
    }
    harapGalat(await ubah(b.customerId, { name: 'a', phone: a.phone }), 422, 'validation_failed', { name: 'too_short' });
    harapGalat(await ubah(b.customerId, { phone: a.phone }), 409, 'phone_taken');
  });

  it('nama dan nomor di SPK lama ikut berubah karena dibaca dari data pelanggan saat ini', async () => {
    const p = await buatPelanggan(kasir.token, { name: 'Nama Lama' });
    const v = await tambahKendaraan(kasir.token, p.customerId);
    const spk = await buatSpk(kasir.token, v.vehicleId);
    const baru = nomorUnik();

    await ubahPelanggan(kasir.token, p.customerId, { name: 'Nama Baru', phone: baru });

    expect((await detailSpk(kasir.token, spk.number)).customer).toEqual({ customerId: p.customerId, name: 'Nama Baru', phone: baru });
  });

  it('booking menyimpan salinannya sendiri: nama dan nomor di booking tidak ikut berubah', async () => {
    const { bookingId, booking } = await buatBookingPublik({ customerName: 'Pemesan Asli' });
    const { workOrder } = await jadikanSpk(kasir.token, bookingId);
    const sebelum = await bookingStaf(kasir.token, bookingId);

    await ubahPelanggan(kasir.token, workOrder.customer.customerId, { name: 'Nama Diganti', phone: nomorUnik() });

    const sesudah = await bookingStaf(kasir.token, bookingId);
    expect(sesudah).toMatchObject({ number: booking.number, customerName: 'Pemesan Asli', phone: sebelum.phone });
  });
});
