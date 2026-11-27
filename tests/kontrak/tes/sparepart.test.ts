// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// POST /api/parts dan PATCH /api/parts/{partId} (khusus pemilik): SKU dibesarkan dan unik
// (sku_taken), stok awal sebagai kartu stok IN "Stok awal", stockLevel, validasi tiap field, aturan
// null, stok yang tidak bisa diubah lewat PATCH, nonaktif, urutan pemeriksaan, dan peran. Daftar
// sparepart (costPrice per peran, lowStock) ada di sparepart-daftar.test.ts.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import {
  buatKasir,
  buatMekanik,
  buatPart,
  buatPelangganDenganKendaraan,
  buatPemilik,
  buatSpk,
  detailSpk,
  namaUnik,
  skuUnik,
  tambahPart,
  type SesiStaf,
} from '../src/data';
import { barisPart, jumlahBaris } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { JSON_RUSAK, jsonLebihDariSatuMib } from './pembantu-fondasi';
import { ID_TAK_ADA, idDianggapTakAda, teksKodePoin } from './pembantu-pelanggan';
import { ambilPart, kartuApi, kirimBuatPart, kirimUbahPart, potretStok, ringkasStaf, tanpaWaktuPart, ubahPart } from './pembantu-stok';

let pemilik: SesiStaf;
let kasir: SesiStaf;
let mekanik: SesiStaf;

beforeAll(async () => {
  pemilik = await buatPemilik();
  kasir = await buatKasir();
  mekanik = await buatMekanik();
});

const buat = (json: unknown, token: string | null = pemilik.token) => kirimBuatPart(token, json);
const isian = (ubah: Record<string, unknown> = {}) => ({ sku: skuUnik('PART'), name: namaUnik('Part'), unit: 'pcs', price: 55000, ...ubah });

describe('POST /api/parts', () => {
  it('contoh permintaan spec: SKU dibesarkan, stok awal 13 dicatat sebagai satu kartu stok IN "Stok awal" oleh pemilik', async () => {
    const res = await buat({ sku: 'oli-10w40-08', name: 'Oli Mesin 10W-40 0,8 L', unit: 'botol', price: 55000, costPrice: 42000, minStock: 5, initialStock: 13 });

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({
      sku: 'OLI-10W40-08',
      name: 'Oli Mesin 10W-40 0,8 L',
      unit: 'botol',
      price: 55000,
      costPrice: 42000,
      stock: 13,
      minStock: 5,
      stockLevel: 'ok',
      isActive: true,
    });
    const kartu = await kartuApi(pemilik.token, res.body.data.partId);
    expect(kartu).toHaveLength(1);
    expect({ ...kartu[0], movementId: null, createdAt: null }).toEqual({
      movementId: null,
      type: 'IN',
      quantity: 13,
      stockAfter: 13,
      note: 'Stok awal',
      workOrderNumber: null,
      staff: ringkasStaf(pemilik),
      createdAt: null,
    });
    expect((await barisPart(res.body.data.partId)).stock).toBe(13);
  });

  it('SKU kembar setelah dibesarkan dan dipangkas → 409 sku_taken', async () => {
    const ada = await buatPart(pemilik.token, { sku: 'kr-dpn-vario' });
    expect(ada.sku).toBe('KR-DPN-VARIO');

    for (const sku of ['KR-DPN-VARIO', 'kr-dpn-vario', '  Kr-Dpn-Vario \t']) {
      harapGalat(await buat(isian({ sku })), 409, 'sku_taken');
    }
    expect(await jumlahBaris('parts', 'sku = ?', ['KR-DPN-VARIO'])).toBe(1);
  });

  it('bawaan: costPrice 0, minStock 0, tanpa stok awal (stok 0, stockLevel out, tanpa kartu stok), aktif', async () => {
    const res = await buat(isian());

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ costPrice: 0, minStock: 0, stock: 0, stockLevel: 'out', isActive: true });
    expect(await jumlahBaris('stock_movements', 'part_id = ?', [res.body.data.partId])).toBe(0);
    expect(await kartuApi(pemilik.token, res.body.data.partId)).toEqual([]);
  });

  it('initialStock 0 tidak membuat kartu stok', async () => {
    const res = await buat(isian({ initialStock: 0, minStock: 3 }));

    harapStatus(res, 201);
    expect(await jumlahBaris('stock_movements', 'part_id = ?', [res.body.data.partId])).toBe(0);
  });

  it('SKU, nama, dan satuan dipangkas; SKU boleh memuat titik, garis bawah, garis miring, dan tanda hubung', async () => {
    const sku = skuUnik('a.b/c_d');
    const res = await buat(isian({ sku: ` \t${sku.toLowerCase()}\n `, name: '  Busi Iridium  ', unit: ' set\r\n' }));

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ sku: sku.toUpperCase(), name: 'Busi Iridium', unit: 'set' });
  });

  it('isActive, stock, dan stockLevel dari badan diabaikan: sparepart baru selalu aktif, stok = initialStock', async () => {
    const res = await buat(isian({ isActive: false, stock: 99, stockLevel: 'ok', initialStock: 2, minStock: 4, partId: ID_TAK_ADA }));

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ isActive: true, stock: 2, stockLevel: 'low' });
    expect(res.body.data.partId).not.toBe(ID_TAK_ADA);
  });

  it.each([
    ['stok 0 → out walau minStock 0', 0, 0, 'out'],
    ['stok 0 → out', 0, 5, 'out'],
    ['stok sama dengan minStock → low', 5, 5, 'low'],
    ['stok di bawah minStock → low', 1, 5, 'low'],
    ['stok satu di atas minStock → ok', 6, 5, 'ok'],
    ['minStock 0, stok 1 → ok', 1, 0, 'ok'],
  ])('stockLevel: %s', async (_judul, initialStock, minStock, level) => {
    const res = await buat(isian({ initialStock, minStock }));

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ stock: initialStock, minStock, stockLevel: level });
  });

  it('nama boleh kembar (SKU yang unik)', async () => {
    const name = namaUnik('Kampas');
    harapStatus(await buat(isian({ name })), 201);
    harapStatus(await buat(isian({ name })), 201);
  });

  it('batas sah: harga 0 dan 100.000.000, harga beli melebihi harga jual, SKU 40, nama 100, satuan 20 code point, stok 100.000.000', async () => {
    const sku40 = `${skuUnik('X').replace(/[^A-Z0-9]/g, '')}${'9'.repeat(40)}`.slice(0, 40);
    const a = await buat(isian({ sku: sku40, price: 0, costPrice: 100_000_000, name: teksKodePoin(100), unit: teksKodePoin(20) }));
    const b = await buat(isian({ price: 100_000_000, initialStock: 100_000_000, minStock: 100_000_000 }));
    const c = await api.post('/api/parts', { token: pemilik.token, mentah: JSON.stringify(isian()).replace('"price":55000', '"price":1.5e4') });

    for (const r of [a, b, c]) {
      harapStatus(r, 201);
    }
    expect(a.body.data).toMatchObject({ sku: sku40, price: 0, costPrice: 100_000_000, name: teksKodePoin(100), unit: teksKodePoin(20) });
    expect(b.body.data).toMatchObject({ stock: 100_000_000, stockLevel: 'low' });
    expect(c.body.data.price).toBe(15000);
  });

  it.each([
    ['badan kosong', null, { sku: 'required', name: 'required', unit: 'required', price: 'required' }],
    ['sku null', { sku: null }, { sku: 'required' }],
    ['sku hanya spasi', { sku: '   ' }, { sku: 'required' }],
    ['sku angka', { sku: 123 }, { sku: 'invalid_type' }],
    ['sku 41 karakter', { sku: 'A'.repeat(41) }, { sku: 'too_long' }],
    ['sku 41 karakter berspasi: panjang dinilai sebelum format', { sku: `A B${'C'.repeat(38)}` }, { sku: 'too_long' }],
    ['sku berspasi di tengah', { sku: 'OLI 10W' }, { sku: 'invalid_format' }],
    ['sku diawali tanda hubung', { sku: '-OLI' }, { sku: 'invalid_format' }],
    ['sku diawali titik', { sku: '.OLI' }, { sku: 'invalid_format' }],
    ['sku memuat #', { sku: 'OLI#1' }, { sku: 'invalid_format' }],
    ['sku huruf non-ASCII', { sku: 'éOLI' }, { sku: 'invalid_format' }],
    ['name kosong', { name: ' ' }, { name: 'required' }],
    ['name null', { name: null }, { name: 'required' }],
    ['name satu huruf', { name: ' a ' }, { name: 'too_short' }],
    ['name 101 code point', { name: teksKodePoin(101) }, { name: 'too_long' }],
    ['name angka', { name: 1 }, { name: 'invalid_type' }],
    ['unit kosong', { unit: '' }, { unit: 'required' }],
    ['unit null', { unit: null }, { unit: 'required' }],
    ['unit 21 code point', { unit: teksKodePoin(21) }, { unit: 'too_long' }],
    ['unit boolean', { unit: true }, { unit: 'invalid_type' }],
    ['price null', { price: null }, { price: 'required' }],
    ['price teks', { price: '55000' }, { price: 'invalid_type' }],
    ['price pecahan', { price: 1.5 }, { price: 'invalid_type' }],
    ['price -1', { price: -1 }, { price: 'out_of_range' }],
    ['price 100.000.001', { price: 100_000_001 }, { price: 'out_of_range' }],
    ['costPrice null', { costPrice: null }, { costPrice: 'invalid_type' }],
    ['costPrice teks', { costPrice: '1' }, { costPrice: 'invalid_type' }],
    ['costPrice -1', { costPrice: -1 }, { costPrice: 'out_of_range' }],
    ['costPrice 100.000.001', { costPrice: 100_000_001 }, { costPrice: 'out_of_range' }],
    ['minStock null', { minStock: null }, { minStock: 'invalid_type' }],
    ['minStock -1', { minStock: -1 }, { minStock: 'out_of_range' }],
    ['minStock 100.000.001', { minStock: 100_000_001 }, { minStock: 'out_of_range' }],
    ['initialStock null', { initialStock: null }, { initialStock: 'invalid_type' }],
    ['initialStock pecahan', { initialStock: 2.5 }, { initialStock: 'invalid_type' }],
    ['initialStock -1', { initialStock: -1 }, { initialStock: 'out_of_range' }],
    ['initialStock 100.000.001', { initialStock: 100_000_001 }, { initialStock: 'out_of_range' }],
    ['semua sekaligus', { sku: '', name: 'a', unit: 5, price: -1, costPrice: null, minStock: 1.5, initialStock: -2 }, { sku: 'required', name: 'too_short', unit: 'invalid_type', price: 'out_of_range', costPrice: 'invalid_type', minStock: 'invalid_type', initialStock: 'out_of_range' }],
  ])('%s → 422 tanpa membuat sparepart', async (_judul, ubah, fields) => {
    const sebelum = await jumlahBaris('parts');

    harapGalat(await buat(ubah === null ? {} : isian(ubah)), 422, 'validation_failed', fields);
    expect(await jumlahBaris('parts')).toBe(sebelum);
  });

  it('price melebihi 2^53−1 (1e400) → out_of_range', async () => {
    const res = await api.post('/api/parts', { token: pemilik.token, mentah: JSON.stringify(isian()).replace('"price":55000', '"price":1e400') });

    harapGalat(res, 422, 'validation_failed', { price: 'out_of_range' });
  });

  it('urutan pemeriksaan: 413 → 400 → 401 → 403 (kasir dan mekanik) → 422 → 409', async () => {
    const ada = await buatPart(pemilik.token);

    harapGalat(await api.post('/api/parts', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.post('/api/parts', { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.post('/api/parts', { mentah: '[]', token: kasir.token }), 400, 'bad_request');
    harapGalat(await buat({}, null), 401, 'unauthenticated');
    for (const sesi of [kasir, mekanik]) {
      harapGalat(await buat({}, sesi.token), 403, 'forbidden');
      harapGalat(await buat(isian(), sesi.token), 403, 'forbidden');
    }
    harapGalat(await buat(isian({ sku: ada.sku, name: 'a' })), 422, 'validation_failed', { name: 'too_short' });
    harapGalat(await buat(isian({ sku: ada.sku })), 409, 'sku_taken');
  });
});

describe('PATCH /api/parts/{partId}', () => {
  const ubah = (id: string, json: unknown, token: string | null = pemilik.token) => kirimUbahPart(token, id, json);

  it('perubahan sebagian: harga dan minStock berubah, stockLevel dihitung ulang, field lain dan stok tetap', async () => {
    const p = await buatPart(pemilik.token, { initialStock: 5, minStock: 2 });

    const res = await ubah(p.partId, { price: 57000, minStock: 6 });

    harapStatus(res, 200);
    expect(tanpaWaktuPart(res.body.data)).toEqual(tanpaWaktuPart({ ...p, price: 57000, minStock: 6, stockLevel: 'low' }));
    harapSetara(await ambilPart(pemilik.token, p), res.body.data);
    expect(await potretStok(p.partId)).toEqual({ stock: 5, costPrice: 40000, barisKartu: 1 });
  });

  it('SKU baru dipangkas dan dibesarkan; nama, satuan, dan harga beli (termasuk 0) bisa diganti', async () => {
    const p = await buatPart(pemilik.token);
    const sku = skuUnik('baru');

    const res = await ubah(p.partId, { sku: ` ${sku.toLowerCase()} `, name: ' Nama Baru ', unit: ' botol ', costPrice: 0 });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ sku: sku.toUpperCase(), name: 'Nama Baru', unit: 'botol', costPrice: 0 });
    expect((await barisPart(p.partId)).cost_price).toBe(0);
  });

  it('{} dan field yang tidak dikenal → 200 tanpa perubahan; stock di badan diabaikan dan tidak membuat kartu stok', async () => {
    const p = await buatPart(pemilik.token, { initialStock: 7 });

    const kosong = await ubah(p.partId, {});
    const asing = await ubah(p.partId, { stock: 999, stockLevel: 'out', initialStock: 50, partId: ID_TAK_ADA });

    for (const res of [kosong, asing]) {
      harapStatus(res, 200);
      expect(tanpaWaktuPart(res.body.data)).toEqual(tanpaWaktuPart(p));
    }
    expect(await potretStok(p.partId)).toEqual({ stock: 7, costPrice: 40000, barisKartu: 1 });
  });

  it('nonaktif dan aktif kembali; sparepart nonaktif tetap ada di daftar', async () => {
    const p = await buatPart(pemilik.token);

    const mati = await ubah(p.partId, { isActive: false });
    harapStatus(mati, 200);
    expect(mati.body.data.isActive).toBe(false);
    expect((await ambilPart(kasir.token, p)).isActive).toBe(false);

    const hidup = await ubah(p.partId, { isActive: true });
    expect(hidup.body.data.isActive).toBe(true);
  });

  it('SKU miliknya sendiri dalam huruf kecil bukan bentrok; SKU sparepart lain → 409 sku_taken tanpa perubahan', async () => {
    const a = await buatPart(pemilik.token);
    const b = await buatPart(pemilik.token);

    const sendiri = await ubah(b.partId, { sku: b.sku.toLowerCase() });
    harapStatus(sendiri, 200);
    expect(sendiri.body.data.sku).toBe(b.sku);

    harapGalat(await ubah(b.partId, { sku: a.sku.toLowerCase(), price: 1 }), 409, 'sku_taken');
    expect(tanpaWaktuPart(await ambilPart(pemilik.token, b))).toEqual(tanpaWaktuPart(b));
  });

  it.each([
    ['sku null', { sku: null }, { sku: 'required' }],
    ['name null', { name: null }, { name: 'required' }],
    ['unit null', { unit: null }, { unit: 'required' }],
    ['price null', { price: null }, { price: 'required' }],
    ['costPrice null', { costPrice: null }, { costPrice: 'invalid_type' }],
    ['minStock null', { minStock: null }, { minStock: 'invalid_type' }],
    ['isActive null', { isActive: null }, { isActive: 'invalid_type' }],
    ['isActive teks', { isActive: 'false' }, { isActive: 'invalid_type' }],
    ['isActive angka', { isActive: 0 }, { isActive: 'invalid_type' }],
    ['sku tidak sah', { sku: 'OLI 10' }, { sku: 'invalid_format' }],
    ['name satu huruf', { name: 'a' }, { name: 'too_short' }],
    ['price 100.000.001', { price: 100_000_001 }, { price: 'out_of_range' }],
    ['minStock -1', { minStock: -1 }, { minStock: 'out_of_range' }],
    ['semua sekaligus', { sku: null, unit: '', price: '1', costPrice: -1, isActive: 1 }, { sku: 'required', unit: 'required', price: 'invalid_type', costPrice: 'out_of_range', isActive: 'invalid_type' }],
  ])('%s → 422 tanpa perubahan', async (_judul, json, fields) => {
    const p = await buatPart(pemilik.token);

    harapGalat(await ubah(p.partId, json), 422, 'validation_failed', fields);
    expect(tanpaWaktuPart(await ambilPart(pemilik.token, p))).toEqual(tanpaWaktuPart(p));
  });

  it('urutan pemeriksaan: 413 → 400 → 401 → 403 (kasir dan mekanik) → 404 → 422 → 409', async () => {
    const a = await buatPart(pemilik.token);
    const b = await buatPart(pemilik.token);
    const path = `/api/parts/${ID_TAK_ADA}`;

    harapGalat(await api.patch(path, { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.patch(path, { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.patch(path, { mentah: '1', token: kasir.token }), 400, 'bad_request');
    harapGalat(await ubah(ID_TAK_ADA, { name: 'a' }, null), 401, 'unauthenticated');
    for (const sesi of [kasir, mekanik]) {
      harapGalat(await ubah(ID_TAK_ADA, { name: 'a' }, sesi.token), 403, 'forbidden');
      harapGalat(await ubah(b.partId, { price: 1 }, sesi.token), 403, 'forbidden');
    }
    for (const id of idDianggapTakAda(b.partId)) {
      harapGalat(await ubah(id, { name: 'a' }), 404, 'not_found');
    }
    harapGalat(await ubah(b.partId, { sku: a.sku, name: 'a' }), 422, 'validation_failed', { name: 'too_short' });
    harapGalat(await ubah(b.partId, { sku: a.sku }), 409, 'sku_taken');
  });

  it('mengubah harga dan menonaktifkan sparepart yang ada di SPK terbuka boleh; item SPK yang sudah ada tidak berubah', async () => {
    const p = await buatPart(pemilik.token, { price: 55000 });
    const { kendaraan } = await buatPelangganDenganKendaraan(kasir.token);
    const spk = await buatSpk(kasir.token, kendaraan.vehicleId);
    const sebelum = await tambahPart(kasir.token, spk.number, p.partId, 2);

    const res = await ubah(p.partId, { price: 60000, name: 'Nama Diganti', isActive: false });

    harapStatus(res, 200);
    const sesudah = await detailSpk(kasir.token, spk.number);
    expect(sesudah.items).toEqual(sebelum.items);
    expect(sesudah.items[0]).toMatchObject({ name: p.name, price: 55000, quantity: 2, subtotal: 110000 });
    expect(sesudah.total).toBe(110000);
  });
});
