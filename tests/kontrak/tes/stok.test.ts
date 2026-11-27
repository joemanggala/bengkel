// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pencatatan stok oleh pemilik: POST /api/parts/{partId}/stock-in, /stock-out, dan /stock-count.
// Tiap pencatatan mengubah stok dan menambah tepat satu baris kartu stok; stok tidak pernah negatif
// (stok keluar melebihi stok → 409 insufficient_stock dengan pesan berformat baku, tanpa perubahan).
// Sparepart nonaktif tetap bisa dicatat. Kasir dan mekanik → 403. Kartu stok ada di
// stok-kartu.test.ts.

import { beforeAll, describe, expect, it } from 'vitest';
import { buatKasir, buatMekanik, buatPart, buatPemilik, hitungStok, stokKeluar, stokMasuk, type SesiStaf } from '../src/data';
import { barisKartuStok, barisPart, sparepartTidakCocokKartu } from '../src/db';
import { harapGalat, harapStatus, harapStokKurang } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { JSON_RUSAK, jsonLebihDariSatuMib } from './pembantu-fondasi';
import { ID_TAK_ADA, idDianggapTakAda, teksKodePoin } from './pembantu-pelanggan';
import { ambilPart, kirimHitungStok, kirimStokKeluar, kirimStokMasuk, potretStok, tanpaWaktuPart, ubahPart } from './pembantu-stok';

let pemilik: SesiStaf;
let kasir: SesiStaf;
let mekanik: SesiStaf;

beforeAll(async () => {
  pemilik = await buatPemilik();
  kasir = await buatKasir();
  mekanik = await buatMekanik();
});

const masuk = (id: string, json: unknown, token: string | null = pemilik.token) => kirimStokMasuk(token, id, json);
const keluar = (id: string, json: unknown, token: string | null = pemilik.token) => kirimStokKeluar(token, id, json);
const hitung = (id: string, json: unknown, token: string | null = pemilik.token) => kirimHitungStok(token, id, json);

// Sparepart baru: stok awal 10, minimum 2, harga beli 40.000 (bawaan buatPart), kecuali diubah.
const partBaru = (ubah: Record<string, unknown> = {}) => buatPart(pemilik.token, ubah);

// Satu-satunya baris kartu stok selain "Stok awal" di database. Tidak memakai urutan waktu, karena
// dua baris bisa tercatat pada milidetik yang sama.
async function kartuTerakhir(partId: string): Promise<any> {
  const baris = (await barisKartuStok(partId)).filter((k) => k.note !== 'Stok awal');
  if (baris.length !== 1) {
    throw new Error(`Seharusnya tepat satu baris kartu stok selain stok awal, ternyata ${baris.length}`);
  }
  return baris[0];
}

describe('POST /api/parts/{partId}/stock-in', () => {
  it('menambah stok; balasan = sparepart sesudahnya; satu kartu IN (jumlah positif, stok sesudah, catatan dipangkas, staf, tanpa SPK)', async () => {
    const p = await partBaru({ initialStock: 10, minStock: 20 });

    const res = await masuk(p.partId, { quantity: 24, note: '  Belanja di toko Sinar Motor \n' });

    harapStatus(res, 200);
    expect(tanpaWaktuPart(res.body.data)).toEqual(tanpaWaktuPart({ ...p, stock: 34, stockLevel: 'ok' }));
    expect(tanpaWaktuPart(await ambilPart(pemilik.token, p))).toEqual(tanpaWaktuPart(res.body.data));
    expect(await kartuTerakhir(p.partId)).toMatchObject({
      type: 'IN',
      quantity: 24,
      stock_after: 34,
      note: 'Belanja di toko Sinar Motor',
      work_order_id: null,
      staff_id: pemilik.staff.staffId,
    });
    expect(await potretStok(p.partId)).toEqual({ stock: 34, costPrice: 40000, barisKartu: 2 });
  });

  it('costPrice yang dikirim menjadi harga beli terakhir (termasuk 0); tidak dikirim = tidak berubah', async () => {
    const p = await partBaru();

    expect((await stokMasuk(pemilik.token, p.partId, 1, { costPrice: 43000 })).costPrice).toBe(43000);
    expect((await stokMasuk(pemilik.token, p.partId, 1)).costPrice).toBe(43000);
    const nol = await stokMasuk(pemilik.token, p.partId, 1, { costPrice: 0 });

    expect(nol).toMatchObject({ costPrice: 0, stock: 13 });
    expect((await barisPart(p.partId)).cost_price).toBe(0);
  });

  it('catatan opsional: tidak dikirim, kosong, atau hanya spasi → ""; 200 code point sah', async () => {
    const p = await partBaru();

    for (const json of [{ quantity: 1 }, { quantity: 1, note: '' }, { quantity: 1, note: ' \t\r\n ' }, { quantity: 1, note: teksKodePoin(200) }]) {
      harapStatus(await masuk(p.partId, json), 200);
    }
    const catatan = (await barisKartuStok(p.partId)).filter((k) => k.note !== 'Stok awal').map((k) => k.note);
    expect([...catatan].sort()).toEqual(['', '', '', teksKodePoin(200)].sort());
  });

  it('stockLevel mengikuti stok baru: out → low → low (tepat batas) → ok', async () => {
    const p = await partBaru({ initialStock: 0, minStock: 5 });
    expect(p.stockLevel).toBe('out');

    expect(await stokMasuk(pemilik.token, p.partId, 3)).toMatchObject({ stock: 3, stockLevel: 'low' });
    expect(await stokMasuk(pemilik.token, p.partId, 2)).toMatchObject({ stock: 5, stockLevel: 'low' });
    expect(await stokMasuk(pemilik.token, p.partId, 1)).toMatchObject({ stock: 6, stockLevel: 'ok' });
  });

  it('sparepart nonaktif boleh dicatat dan tetap nonaktif', async () => {
    const p = await partBaru({ initialStock: 4 });
    await ubahPart(pemilik.token, p.partId, { isActive: false });

    const res = await masuk(p.partId, { quantity: 6 });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ stock: 10, isActive: false });
  });

  it('batas sah: jumlah 1 dan 100.000.000; integer boleh ditulis 5.0 atau 1e2; field tak dikenal (stock, minStock) diabaikan', async () => {
    const p = await partBaru({ initialStock: 0 });

    expect((await masuk(p.partId, { quantity: 1, stock: 999, minStock: 77 })).body.data).toMatchObject({ stock: 1, minStock: 2 });
    expect((await masuk(p.partId, { quantity: 100_000_000 })).body.data.stock).toBe(100_000_001);
    harapStatus(await api.post(`/api/parts/${p.partId}/stock-in`, { token: pemilik.token, mentah: '{"quantity":5.0}' }), 200);
    const eksponen = await api.post(`/api/parts/${p.partId}/stock-in`, { token: pemilik.token, mentah: '{"quantity":1e2}' });
    expect(eksponen.body.data.stock).toBe(100_000_106);
  });

  it.each([
    ['quantity tidak dikirim', { quantity: undefined }, { quantity: 'required' }],
    ['quantity null', { quantity: null }, { quantity: 'required' }],
    ['quantity teks', { quantity: '5' }, { quantity: 'invalid_type' }],
    ['quantity pecahan', { quantity: 1.5 }, { quantity: 'invalid_type' }],
    ['quantity 0', { quantity: 0 }, { quantity: 'out_of_range' }],
    ['quantity -1', { quantity: -1 }, { quantity: 'out_of_range' }],
    ['quantity 100.000.001', { quantity: 100_000_001 }, { quantity: 'out_of_range' }],
    ['costPrice null', { costPrice: null }, { costPrice: 'invalid_type' }],
    ['costPrice teks', { costPrice: '100' }, { costPrice: 'invalid_type' }],
    ['costPrice -1', { costPrice: -1 }, { costPrice: 'out_of_range' }],
    ['costPrice 100.000.001', { costPrice: 100_000_001 }, { costPrice: 'out_of_range' }],
    ['note null', { note: null }, { note: 'invalid_type' }],
    ['note angka', { note: 5 }, { note: 'invalid_type' }],
    ['note 201 code point', { note: teksKodePoin(201) }, { note: 'too_long' }],
    ['semua sekaligus', { quantity: 0, costPrice: -1, note: 5 }, { quantity: 'out_of_range', costPrice: 'out_of_range', note: 'invalid_type' }],
  ])('%s → 422; stok, harga beli, dan kartu stok tidak berubah', async (_judul, ubah, fields) => {
    const p = await partBaru();
    const sebelum = await potretStok(p.partId);

    harapGalat(await masuk(p.partId, { quantity: 3, ...ubah }), 422, 'validation_failed', fields);
    expect(await potretStok(p.partId)).toEqual(sebelum);
  });
});

describe('POST /api/parts/{partId}/stock-out', () => {
  it('mengurangi stok; satu kartu OUT dengan jumlah negatif dan catatan wajib yang dipangkas', async () => {
    const p = await partBaru({ initialStock: 10 });

    const res = await keluar(p.partId, { quantity: 1, note: ' Botol pecah ' });

    harapStatus(res, 200);
    expect(tanpaWaktuPart(res.body.data)).toEqual(tanpaWaktuPart({ ...p, stock: 9 }));
    expect(await kartuTerakhir(p.partId)).toMatchObject({ type: 'OUT', quantity: -1, stock_after: 9, note: 'Botol pecah', work_order_id: null, staff_id: pemilik.staff.staffId });
  });

  it('mengeluarkan seluruh stok sah: stok 0 dan stockLevel out, tidak pernah negatif', async () => {
    const p = await partBaru({ initialStock: 4, minStock: 1 });

    const res = await keluar(p.partId, { quantity: 4, note: 'Hilang' });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ stock: 0, stockLevel: 'out' });
    expect((await kartuTerakhir(p.partId)).stock_after).toBe(0);
  });

  it('melebihi stok → 409 insufficient_stock dengan pesan baku; tidak ada yang berubah', async () => {
    const p = await partBaru({ name: 'Kampas Rem Depan Vario', unit: 'set', initialStock: 2 });
    const sebelum = await potretStok(p.partId);

    harapStokKurang(await keluar(p.partId, { quantity: 3, note: 'Rusak' }), { name: 'Kampas Rem Depan Vario', unit: 'set', butuh: 3, tersedia: 2 });
    expect(await potretStok(p.partId)).toEqual(sebelum);
  });

  it('pesan insufficient_stock memakai angka polos tanpa pemisah ribuan; stok 0 → "tersedia 0"', async () => {
    const banyak = await partBaru({ name: 'Baut M6', unit: 'pcs', initialStock: 1500 });
    const habis = await partBaru({ name: 'Klem Selang', unit: 'pcs', initialStock: 0 });

    harapStokKurang(await keluar(banyak.partId, { quantity: 2000, note: 'Rusak' }), { name: 'Baut M6', unit: 'pcs', butuh: 2000, tersedia: 1500 });
    harapStokKurang(await keluar(habis.partId, { quantity: 1, note: 'Rusak' }), { name: 'Klem Selang', unit: 'pcs', butuh: 1, tersedia: 0 });
  });

  it('sparepart nonaktif boleh dicatat keluar', async () => {
    const p = await partBaru({ initialStock: 5 });
    await ubahPart(pemilik.token, p.partId, { isActive: false });

    harapStatus(await keluar(p.partId, { quantity: 2, note: 'Kedaluwarsa' }), 200);
    expect((await barisPart(p.partId)).stock).toBe(3);
  });

  it.each([
    ['note tidak dikirim', { note: undefined }, { note: 'required' }],
    ['note null', { note: null }, { note: 'required' }],
    ['note kosong', { note: '' }, { note: 'required' }],
    ['note hanya spasi', { note: ' \t\r\n' }, { note: 'required' }],
    ['note angka', { note: 1 }, { note: 'invalid_type' }],
    ['note 201 code point', { note: teksKodePoin(201) }, { note: 'too_long' }],
    ['quantity null', { quantity: null }, { quantity: 'required' }],
    ['quantity 0', { quantity: 0 }, { quantity: 'out_of_range' }],
    ['quantity teks', { quantity: '1' }, { quantity: 'invalid_type' }],
    ['422 dinilai sebelum 409: catatan kosong dan jumlah melebihi stok', { quantity: 999, note: '' }, { note: 'required' }],
    ['badan kosong', { quantity: undefined, note: undefined }, { quantity: 'required', note: 'required' }],
  ])('%s → 422 tanpa perubahan', async (_judul, ubah, fields) => {
    const p = await partBaru({ initialStock: 10 });
    const sebelum = await potretStok(p.partId);

    harapGalat(await keluar(p.partId, { quantity: 1, note: 'Rusak', ...ubah }), 422, 'validation_failed', fields);
    expect(await potretStok(p.partId)).toEqual(sebelum);
  });
});

describe('POST /api/parts/{partId}/stock-count', () => {
  it.each([
    ['lebih sedikit: selisih negatif', 12, 9, -3],
    ['lebih banyak: selisih positif', 5, 8, 3],
    ['sama: selisih 0 tetap dicatat sebagai bukti hitung', 7, 7, 0],
    ['menjadi 0', 4, 0, -4],
  ])('%s', async (_judul, awal, dihitung, selisih) => {
    const p = await partBaru({ initialStock: awal, minStock: 2 });

    const res = await hitung(p.partId, { countedStock: dihitung, note: ' Opname akhir bulan ' });

    harapStatus(res, 200);
    expect(res.body.data.stock).toBe(dihitung);
    expect(await kartuTerakhir(p.partId)).toMatchObject({
      type: 'COUNT',
      quantity: selisih,
      stock_after: dihitung,
      note: 'Opname akhir bulan',
      work_order_id: null,
      staff_id: pemilik.staff.staffId,
    });
    expect(await potretStok(p.partId)).toEqual({ stock: dihitung, costPrice: 40000, barisKartu: 2 });
  });

  it('batas sah 100.000.000; sparepart nonaktif boleh dihitung', async () => {
    const p = await partBaru({ initialStock: 1 });
    await ubahPart(pemilik.token, p.partId, { isActive: false });

    const res = await hitung(p.partId, { countedStock: 100_000_000, note: 'Opname' });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ stock: 100_000_000, isActive: false });
  });

  it.each([
    ['countedStock tidak dikirim', { countedStock: undefined }, { countedStock: 'required' }],
    ['countedStock null', { countedStock: null }, { countedStock: 'required' }],
    ['countedStock teks', { countedStock: '5' }, { countedStock: 'invalid_type' }],
    ['countedStock pecahan', { countedStock: 2.5 }, { countedStock: 'invalid_type' }],
    ['countedStock -1', { countedStock: -1 }, { countedStock: 'out_of_range' }],
    ['countedStock 100.000.001', { countedStock: 100_000_001 }, { countedStock: 'out_of_range' }],
    ['note tidak dikirim', { note: undefined }, { note: 'required' }],
    ['note null', { note: null }, { note: 'required' }],
    ['note hanya spasi', { note: '   ' }, { note: 'required' }],
    ['note 201 code point', { note: teksKodePoin(201) }, { note: 'too_long' }],
    ['semua sekaligus', { countedStock: -1, note: false }, { countedStock: 'out_of_range', note: 'invalid_type' }],
  ])('%s → 422 tanpa perubahan', async (_judul, ubah, fields) => {
    const p = await partBaru();
    const sebelum = await potretStok(p.partId);

    harapGalat(await hitung(p.partId, { countedStock: 3, note: 'Opname', ...ubah }), 422, 'validation_failed', fields);
    expect(await potretStok(p.partId)).toEqual(sebelum);
  });
});

describe('pencatatan stok: peran dan urutan pemeriksaan', () => {
  const RUTE: Array<[string, (id: string, json: unknown, token: string | null) => Promise<Respons>, Record<string, unknown>]> = [
    ['stock-in', masuk, { quantity: 1 }],
    ['stock-out', keluar, { quantity: 1, note: 'Rusak' }],
    ['stock-count', hitung, { countedStock: 1, note: 'Opname' }],
  ];

  it.each(RUTE)('%s: kasir dan mekanik → 403 tanpa perubahan', async (_rute, kirim, json) => {
    const p = await partBaru();
    const sebelum = await potretStok(p.partId);

    for (const sesi of [kasir, mekanik]) {
      harapGalat(await kirim(p.partId, json, sesi.token), 403, 'forbidden');
    }
    expect(await potretStok(p.partId)).toEqual(sebelum);
  });

  it.each(RUTE)('%s: 413 → 400 → 401 → 403 → 404 → 422', async (rute, kirim) => {
    const p = await partBaru();
    const path = `/api/parts/${ID_TAK_ADA}/${rute}`;

    harapGalat(await api.post(path, { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.post(path, { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.post(path, { mentah: '', token: kasir.token }), 400, 'bad_request');
    harapGalat(await kirim(ID_TAK_ADA, {}, null), 401, 'unauthenticated');
    harapGalat(await kirim(ID_TAK_ADA, {}, kasir.token), 403, 'forbidden');
    harapGalat(await kirim(ID_TAK_ADA, {}, mekanik.token), 403, 'forbidden');
    for (const id of idDianggapTakAda(p.partId)) {
      harapGalat(await kirim(id, {}, pemilik.token), 404, 'not_found');
    }
    const kode: Record<string, string> = rute === 'stock-count' ? { countedStock: 'required', note: 'required' } : rute === 'stock-out' ? { quantity: 'required', note: 'required' } : { quantity: 'required' };
    harapGalat(await kirim(p.partId, {}, pemilik.token), 422, 'validation_failed', kode);
  });

  it('serangkaian pencatatan: jumlah semua quantity kartu stok sama dengan stok setiap sparepart', async () => {
    const p = await partBaru({ initialStock: 10 });
    await stokMasuk(pemilik.token, p.partId, 5);
    await stokKeluar(pemilik.token, p.partId, 12);
    await hitungStok(pemilik.token, p.partId, 7);
    await stokMasuk(pemilik.token, p.partId, 3);

    expect((await barisPart(p.partId)).stock).toBe(10);
    // Dibandingkan sebagai himpunan: urutan waktu bisa kembar pada milidetik yang sama.
    const kartu = (await barisKartuStok(p.partId)).map((k) => `${k.type} ${k.quantity} → ${k.stock_after}`);
    expect(kartu.sort()).toEqual(['COUNT 4 → 7', 'IN 10 → 10', 'IN 3 → 10', 'IN 5 → 15', 'OUT -12 → 3'].sort());
    expect(await sparepartTidakCocokKartu()).toEqual([]);
  });
});
