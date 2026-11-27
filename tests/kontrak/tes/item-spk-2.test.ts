// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// POST /api/work-orders/{number}/items dan DELETE …/items/{itemId}: validasi badan,
// rujukan nonaktif, urutan pemeriksaan, work_order_locked, batas 50 item, dan
// total_below_paid (keputusan 0a-7). Urutan tambah: 413 → 400 → 401 → 403 → 404 → 422
// (badan dan rujukan) → 409 work_order_locked → 422 too_many_items → 422 part nonaktif
// / 409 insufficient_stock. Urutan hapus: 401 → 403 → 404 SPK → 404 item → 409
// work_order_locked → 409 total_below_paid.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import { bayar, buatJasa, buatPart, buatSpk, detailSpk, siapkanBengkel, tambahJasa, tambahPart, ubahStatus, type Bengkel } from '../src/data';
import { barisKartuStok, setAktif } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { JSON_RUSAK, jsonLebihDariSatuMib, tokenAcak } from './pembantu-fondasi';
import { kartuSpk, kirimHapus, kirimItem, spkDiStatus, stokDb, uuidAcak, type StatusSpk } from './pembantu-spk';

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
});

const spkBaru = () => buatSpk(b.kasir.token, b.kendaraan.vehicleId);
const jasa = (ubah: Record<string, unknown> = {}) => ({ type: 'SERVICE', serviceId: b.gantiOli.serviceId, quantity: 1, ...ubah });
const part = (ubah: Record<string, unknown> = {}) => ({ type: 'PART', partId: b.oli.partId, quantity: 1, ...ubah });
// Untuk tabel it.each yang disusun sebelum beforeAll berjalan: ID ditulis sebagai
// penanda ('JASA', 'OLI', 'OLI_BESAR', 'ACAK') dan diganti saat tes berjalan.
const tJasa = (ubah: Record<string, unknown> = {}) => ({ type: 'SERVICE', serviceId: 'JASA', quantity: 1, ...ubah });
const tPart = (ubah: Record<string, unknown> = {}) => ({ type: 'PART', partId: 'OLI', quantity: 1, ...ubah });

describe('POST …/items: validasi badan', () => {
  it.each<[string, Record<string, unknown>, Record<string, string>]>([
    ['type tidak dikirim (field lain tidak diperiksa)', { serviceId: 'x', quantity: 0 }, { type: 'required' }],
    ['type null', { type: null, quantity: 'a' }, { type: 'required' }],
    ['type kosong', { type: '', partId: 5 }, { type: 'required' }],
    ['type angka', { type: 1, quantity: 1 }, { type: 'invalid_type' }],
    ['type huruf kecil', { type: 'service', serviceId: 'x', quantity: 0 }, { type: 'invalid_format' }],
    ['type tak dikenal', { type: 'DISKON', quantity: 1 }, { type: 'invalid_format' }],
    ['SERVICE tanpa serviceId', tJasa({ serviceId: undefined }), { serviceId: 'required' }],
    ['SERVICE serviceId null', tJasa({ serviceId: null }), { serviceId: 'required' }],
    ['SERVICE serviceId kosong', tJasa({ serviceId: '' }), { serviceId: 'required' }],
    ['SERVICE serviceId angka', tJasa({ serviceId: 9 }), { serviceId: 'invalid_type' }],
    ['SERVICE serviceId bukan UUID', tJasa({ serviceId: 'ganti-oli' }), { serviceId: 'invalid_format' }],
    ['SERVICE serviceId tak dikenal', tJasa({ serviceId: 'ACAK' }), { serviceId: 'unknown_reference' }],
    ['SERVICE serviceId berisi ID sparepart', tJasa({ serviceId: 'OLI' }), { serviceId: 'unknown_reference' }],
    ['SERVICE: partId salah diabaikan', tJasa({ partId: 'bukan-uuid' }), {}],
    ['PART tanpa partId', tPart({ partId: undefined }), { partId: 'required' }],
    ['PART partId null', tPart({ partId: null }), { partId: 'required' }],
    ['PART partId angka', tPart({ partId: 1 }), { partId: 'invalid_type' }],
    ['PART partId huruf besar', tPart({ partId: 'OLI_BESAR' }), { partId: 'invalid_format' }],
    ['PART partId tak dikenal', tPart({ partId: 'ACAK' }), { partId: 'unknown_reference' }],
    ['PART: serviceId salah diabaikan', tPart({ serviceId: 5 }), {}],
    ['quantity tidak dikirim', tJasa({ quantity: undefined }), { quantity: 'required' }],
    ['quantity null', tJasa({ quantity: null }), { quantity: 'required' }],
    ['quantity 0', tJasa({ quantity: 0 }), { quantity: 'out_of_range' }],
    ['quantity 100', tPart({ quantity: 100 }), { quantity: 'out_of_range' }],
    ['quantity pecahan', tJasa({ quantity: 1.5 }), { quantity: 'invalid_type' }],
    ['quantity teks', tPart({ quantity: '1' }), { quantity: 'invalid_type' }],
    ['price jasa null', tJasa({ price: null }), { price: 'invalid_type' }],
    ['price jasa negatif', tJasa({ price: -1 }), { price: 'out_of_range' }],
    ['price jasa di atas 100.000.000', tJasa({ price: 100_000_001 }), { price: 'out_of_range' }],
    ['price jasa pecahan', tJasa({ price: 0.5 }), { price: 'invalid_type' }],
    ['price jasa teks', tJasa({ price: '90000' }), { price: 'invalid_type' }],
    ['beberapa field salah sekaligus', tJasa({ serviceId: 'x', quantity: 0, price: -1 }), { serviceId: 'invalid_format', quantity: 'out_of_range', price: 'out_of_range' }],
  ])('%s', async (_nama, badan, fields) => {
    const spk = await spkBaru();
    const isi: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(badan)) {
      if (v === undefined) continue;
      const pengganti: Record<string, () => string> = {
        ACAK: uuidAcak,
        JASA: () => b.gantiOli.serviceId,
        OLI: () => b.oli.partId,
        OLI_BESAR: () => b.oli.partId.toUpperCase(),
      };
      isi[k] = typeof v === 'string' && pengganti[v] ? pengganti[v]() : v;
    }

    const res = await kirimItem(b.kasir.token, spk.number, isi);

    if (Object.keys(fields).length === 0) {
      harapStatus(res, 201);
    } else {
      harapGalat(res, 422, 'validation_failed', fields);
      expect((await detailSpk(b.kasir.token, spk.number)).items).toEqual([]);
    }
  });

  it('batas quantity 1 dan 99 sah', async () => {
    const spk = await spkBaru();
    harapStatus(await kirimItem(b.kasir.token, spk.number, jasa({ quantity: 1 })), 201);
    const res = await kirimItem(b.kasir.token, spk.number, jasa({ quantity: 99 }));
    harapStatus(res, 201);
    expect(res.body.data.items.map((i: any) => i.quantity)).toEqual([1, 99]);
  });

  it('jasa nonaktif → 422 serviceId inactive_reference; tidak ada yang berubah', async () => {
    const mati = await buatJasa(b.pemilik.token);
    await setAktif('services', mati.serviceId, false);
    const spk = await spkBaru();

    harapGalat(await kirimItem(b.kasir.token, spk.number, jasa({ serviceId: mati.serviceId })), 422, 'validation_failed', {
      serviceId: 'inactive_reference',
    });
  });

  it('sparepart nonaktif → 422 partId inactive_reference; stok dan kartu tidak berubah', async () => {
    const mati = await buatPart(b.pemilik.token, { initialStock: 5 });
    await setAktif('parts', mati.partId, false);
    const spk = await spkBaru();

    harapGalat(await kirimItem(b.kasir.token, spk.number, part({ partId: mati.partId })), 422, 'validation_failed', { partId: 'inactive_reference' });
    expect(await stokDb(mati.partId)).toBe(5);
    expect((await barisKartuStok(mati.partId)).length).toBe(1);
  });

  it('field lain di badan diabaikan (name, subtotal, costPrice)', async () => {
    const spk = await spkBaru();

    const res = await kirimItem(b.kasir.token, spk.number, part({ name: 'Palsu', subtotal: 1, costPrice: 1, itemId: uuidAcak() }));

    harapStatus(res, 201);
    expect(res.body.data.items[0]).toMatchObject({ name: 'Oli Mesin 10W-40 0,8 L', price: 55_000, subtotal: 55_000 });
  });
});

describe('POST …/items: urutan pemeriksaan', () => {
  it('413 dan 400 lebih dulu dari 401, 403, dan 404', async () => {
    harapGalat(await api.post('/api/work-orders/S-999999/items', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    for (const mentah of [JSON_RUSAK, '[]', '"x"', '']) {
      harapGalat(await api.post('/api/work-orders/S-999999/items', { mentah }), 400, 'bad_request');
    }
  });

  it('401 lebih dulu dari 403 dan 404', async () => {
    harapGalat(await kirimItem('', 'S-999999', {}), 401, 'unauthenticated');
    harapGalat(await kirimItem(tokenAcak(), 'S-999999', jasa()), 401, 'unauthenticated');
  });

  it('mekanik → 403, juga untuk SPK miliknya dan nomor yang tidak ada (403 peran lebih dulu dari 404)', async () => {
    const milik = await spkDiStatus(b, 'IN_PROGRESS', { mekanik: b.mekanik });

    harapGalat(await kirimItem(b.mekanik.token, milik.number, part()), 403, 'forbidden');
    harapGalat(await kirimItem(b.mekanik.token, 'S-999999', {}), 403, 'forbidden');
    expect((await detailSpk(b.kasir.token, milik.number)).items).toHaveLength(1);
  });

  it('404 lebih dulu dari 422: nomor tidak ada atau bentuk lain', async () => {
    const spk = await spkBaru();
    for (const n of ['S-999999', spk.number.toLowerCase(), 'S-77']) {
      harapGalat(await kirimItem(b.kasir.token, n, {}), 404, 'not_found');
    }
  });

  it('422 (badan dan rujukan) lebih dulu dari 409 work_order_locked', async () => {
    const mati = await buatPart(b.pemilik.token);
    await setAktif('parts', mati.partId, false);
    const selesai = await spkDiStatus(b, 'DONE');

    harapGalat(await kirimItem(b.kasir.token, selesai.number, jasa({ quantity: 0 })), 422, 'validation_failed', { quantity: 'out_of_range' });
    harapGalat(await kirimItem(b.kasir.token, selesai.number, part({ partId: uuidAcak() })), 422, 'validation_failed', { partId: 'unknown_reference' });
    harapGalat(await kirimItem(b.kasir.token, selesai.number, part({ partId: mati.partId })), 422, 'validation_failed', { partId: 'inactive_reference' });
  });

  it('409 work_order_locked lebih dulu dari insufficient_stock', async () => {
    const sedikit = await buatPart(b.pemilik.token, { initialStock: 1 });
    const selesai = await spkDiStatus(b, 'DONE');

    harapGalat(await kirimItem(b.kasir.token, selesai.number, part({ partId: sedikit.partId, quantity: 5 })), 409, 'work_order_locked');
    expect(await stokDb(sedikit.partId)).toBe(1);
  });
});

describe('Item SPK: terkunci sejak DONE → 409 work_order_locked', () => {
  it.each<StatusSpk>(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS'])('%s: item boleh ditambah dan dihapus', async (status) => {
    const spk = await spkDiStatus(b, status);

    const tambah = await kirimItem(b.kasir.token, spk.number, part());
    harapStatus(tambah, 201);
    harapStatus(await kirimHapus(b.kasir.token, spk.number, tambah.body.data.items.at(-1).itemId), 200);
  });

  it.each<StatusSpk>(['DONE', 'PICKED_UP', 'CANCELLED'])('%s: tambah dan hapus item → 409; item, stok, dan total tetap', async (status) => {
    const spk = await spkDiStatus(b, status);
    const stok = await stokDb(b.oli.partId);

    harapGalat(await kirimItem(b.kasir.token, spk.number, part()), 409, 'work_order_locked');
    harapGalat(await kirimItem(b.kasir.token, spk.number, jasa()), 409, 'work_order_locked');
    harapGalat(await kirimHapus(b.kasir.token, spk.number, spk.items[0].itemId), 409, 'work_order_locked');

    expect(await stokDb(b.oli.partId)).toBe(stok);
    harapSetara(await detailSpk(b.kasir.token, spk.number), spk);
  });
});

describe('Item SPK: paling banyak 50 item', () => {
  it('item ke-51 → 422 items: too_many_items (lebih dulu dari stok kurang); hapus satu lalu tambah lagi boleh; sesudah DONE → 409 locked', async () => {
    const spk = await spkBaru();
    for (let i = 0; i < 50; i += 1) {
      await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId);
    }
    const sedikit = await buatPart(b.pemilik.token, { initialStock: 1 });

    harapGalat(await kirimItem(b.kasir.token, spk.number, jasa()), 422, 'validation_failed', { items: 'too_many_items' });
    harapGalat(await kirimItem(b.kasir.token, spk.number, part({ partId: sedikit.partId, quantity: 9 })), 422, 'validation_failed', {
      items: 'too_many_items',
    });
    const penuh = await detailSpk(b.kasir.token, spk.number);
    expect(penuh.items).toHaveLength(50);

    harapStatus(await kirimHapus(b.kasir.token, spk.number, penuh.items[0].itemId), 200);
    harapStatus(await kirimItem(b.kasir.token, spk.number, jasa()), 201);
    harapGalat(await kirimItem(b.kasir.token, spk.number, jasa()), 422, 'validation_failed', { items: 'too_many_items' });

    await ubahStatus(b.kasir.token, spk.number, 'IN_PROGRESS');
    await ubahStatus(b.kasir.token, spk.number, 'DONE');
    harapGalat(await kirimItem(b.kasir.token, spk.number, jasa()), 409, 'work_order_locked');
  });
});

describe('DELETE …/items/{itemId}: urutan 401 → 403 → 404 → 404 item → 409', () => {
  it('401 lebih dulu dari 403 dan 404', async () => {
    harapGalat(await kirimHapus('', 'S-999999', uuidAcak()), 401, 'unauthenticated');
  });

  it('mekanik → 403, juga untuk SPK miliknya dan nomor yang tidak ada', async () => {
    const milik = await spkDiStatus(b, 'IN_PROGRESS', { mekanik: b.mekanik });

    harapGalat(await kirimHapus(b.mekanik.token, milik.number, milik.items[0].itemId), 403, 'forbidden');
    harapGalat(await kirimHapus(b.mekanik.token, 'S-999999', uuidAcak()), 403, 'forbidden');
    expect((await detailSpk(b.kasir.token, milik.number)).items).toHaveLength(1);
  });

  it('SPK tidak ada → 404; item tak dikenal, milik SPK lain, huruf besar, atau sudah dihapus → 404', async () => {
    const a = await spkDiStatus(b, 'QUEUED');
    const lain = await spkDiStatus(b, 'QUEUED');
    const ganda = await tambahJasa(b.kasir.token, a.number, b.gantiOli.serviceId);
    const dihapus = ganda.items[1].itemId;
    harapStatus(await kirimHapus(b.kasir.token, a.number, dihapus), 200);

    harapGalat(await kirimHapus(b.kasir.token, 'S-999999', a.items[0].itemId), 404, 'not_found');
    for (const itemId of [uuidAcak(), lain.items[0].itemId, a.items[0].itemId.toUpperCase(), dihapus, 'bukan-uuid']) {
      harapGalat(await kirimHapus(b.kasir.token, a.number, itemId), 404, 'not_found');
    }
    expect((await detailSpk(b.kasir.token, lain.number)).items).toHaveLength(1);
  });

  it('404 item lebih dulu dari 409 locked: item milik SPK lain pada SPK DONE → 404', async () => {
    const selesai = await spkDiStatus(b, 'DONE');
    const lain = await spkDiStatus(b, 'QUEUED');

    harapGalat(await kirimHapus(b.kasir.token, selesai.number, lain.items[0].itemId), 404, 'not_found');
  });
});

describe('DELETE …/items/{itemId}: total tidak boleh di bawah yang sudah dibayar (409 total_below_paid)', () => {
  it('total sesudah dihapus lebih kecil dari paidAmount → 409; item, stok, dan kartu tidak berubah', async () => {
    const spk = await spkBaru();
    await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId);
    const isi = await tambahPart(b.kasir.token, spk.number, b.oli.partId, 1);
    const dibayar = await bayar(b.kasir.token, spk.number, 60_000);
    const stok = await stokDb(b.oli.partId);
    const kartu = (await kartuSpk(b.oli.partId, spk.number)).length;

    // Total 90.000, dibayar 60.000: menghapus oli menyisakan 35.000, menghapus jasa 55.000.
    harapGalat(await kirimHapus(b.kasir.token, spk.number, isi.items[1].itemId), 409, 'total_below_paid');
    harapGalat(await kirimHapus(b.kasir.token, spk.number, isi.items[0].itemId), 409, 'total_below_paid');

    expect(await stokDb(b.oli.partId)).toBe(stok);
    expect((await kartuSpk(b.oli.partId, spk.number)).length).toBe(kartu);
    harapSetara(await detailSpk(b.kasir.token, spk.number), dibayar);
  });

  it('total sesudah dihapus sama dengan paidAmount → 200 (tidak lebih kecil), status bayar menjadi paid', async () => {
    const spk = await spkBaru();
    await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId);
    const isi = await tambahPart(b.kasir.token, spk.number, b.oli.partId, 1);
    await bayar(b.kasir.token, spk.number, 55_000);

    const res = await kirimHapus(b.kasir.token, spk.number, isi.items[0].itemId);

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ total: 55_000, paidAmount: 55_000, remainingAmount: 0, paymentStatus: 'paid' });
  });

  it('409 work_order_locked lebih dulu dari total_below_paid: SPK DONE lunas', async () => {
    const selesai = await spkDiStatus(b, 'DONE');
    await bayar(b.kasir.token, selesai.number, selesai.total);

    harapGalat(await kirimHapus(b.kasir.token, selesai.number, selesai.items[0].itemId), 409, 'work_order_locked');
  });
});
