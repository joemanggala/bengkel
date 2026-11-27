// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// POST /api/work-orders/{number}/items dan DELETE …/items/{itemId}: salinan nama dan
// harga, harga jasa boleh diisi, harga part selalu katalog, total dihitung ulang, stok
// berkurang saat item part ditambah (USED) dan kembali saat dihapus (RETURNED), dua
// item part yang sama, insufficient_stock dengan pesan baku, dan harga beli yang tidak
// pernah muncul di respons. Validasi, urutan, kunci, dan batas ada di item-spk-2.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import { buatJasa, buatPart, buatSpk, detailSpk, hapusItem, siapkanBengkel, tambahJasa, tambahPart, type Bengkel } from '../src/data';
import { barisItemSpk, barisKartuStok, idSpk, setAktif, sparepartTidakCocokKartu } from '../src/db';
import { hitungTotal } from '../src/format';
import { harapStatus, harapStokKurang } from '../src/galat';
import { api } from '../src/klien';
import {
  ambilSpk,
  harapTanpaHargaBeli,
  kartuSpk,
  kirimHapus,
  kirimItem,
  mundurkanUpdatedAt,
  pergerakanApi,
  ringkasStaf,
  sesudahWaktuLama,
  stokDb,
} from './pembantu-spk';

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
});

const spkBaru = () => buatSpk(b.kasir.token, b.kendaraan.vehicleId);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Total di rincian SPK selalu sama dengan jumlah subtotal itemnya.
function harapTotalCocok(spk: any): void {
  const t = hitungTotal(spk.items);
  expect({ serviceSubtotal: spk.serviceSubtotal, partSubtotal: spk.partSubtotal, total: spk.total }).toEqual(t);
  expect(spk.remainingAmount).toBe(spk.total - spk.paidAmount);
  for (const i of spk.items) {
    expect(i.subtotal).toBe(i.price * i.quantity);
  }
}

describe('POST /api/work-orders/{number}/items: jasa', () => {
  it('201: nama dan harga dari katalog, subtotal = harga × jumlah, total dihitung ulang, harga beli 0 di database', async () => {
    const spk = await spkBaru();
    expect(spk.paymentStatus).toBe('paid');

    const res = await kirimItem(b.kasir.token, spk.number, { type: 'SERVICE', serviceId: b.gantiOli.serviceId, quantity: 2 });

    harapStatus(res, 201);
    const d = res.body.data;
    expect(d.items).toEqual([
      {
        itemId: expect.stringMatching(UUID),
        type: 'SERVICE',
        serviceId: b.gantiOli.serviceId,
        partId: null,
        name: b.gantiOli.name,
        price: 35_000,
        quantity: 2,
        subtotal: 70_000,
        createdAt: expect.any(String),
      },
    ]);
    expect(d).toMatchObject({ serviceSubtotal: 70_000, partSubtotal: 0, total: 70_000, paidAmount: 0, remainingAmount: 70_000, paymentStatus: 'unpaid' });
    expect(await barisItemSpk(spk.number)).toMatchObject([{ type: 'SERVICE', price: 35_000, cost_price: 0, quantity: 2, subtotal: 70_000 }]);
    harapSetara(await detailSpk(b.kasir.token, spk.number), d);
  });

  it('harga jasa boleh diisi lain (0 sampai 100.000.000); harga katalog tidak berubah', async () => {
    const spk = await spkBaru();

    await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId, 1, 90_000);
    await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId, 1, 0);
    await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId, 2, 100_000_000);
    const d = await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId, 1);

    expect(d.items.map((i: any) => [i.price, i.quantity, i.subtotal])).toEqual([
      [90_000, 1, 90_000],
      [0, 1, 0],
      [100_000_000, 2, 200_000_000],
      [35_000, 1, 35_000],
    ]);
    expect(d.total).toBe(200_125_000);
    harapTotalCocok(d);
  });

  it('jasa yang tidak tampil di website boleh dipakai; pemilik juga boleh menambah item', async () => {
    const spk = await spkBaru();

    const res = await kirimItem(b.pemilik.token, spk.number, { type: 'SERVICE', serviceId: b.cekKelistrikan.serviceId, quantity: 1 });

    harapStatus(res, 201);
    expect(res.body.data.items[0]).toMatchObject({ name: b.cekKelistrikan.name, price: 50_000 });
    expect((await barisItemSpk(spk.number))[0]?.created_by_staff_id).toBe(b.pemilik.staff.staffId);
  });

  it('item baru selalu di akhir daftar; jasa dan part bercampur dengan subtotal masing-masing', async () => {
    const spk = await spkBaru();
    await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId);
    await tambahPart(b.kasir.token, spk.number, b.oli.partId, 1);
    const d = await tambahPart(b.kasir.token, spk.number, b.kampas.partId, 1);

    expect(d.items.map((i: any) => i.name)).toEqual([b.gantiOli.name, 'Oli Mesin 10W-40 0,8 L', 'Kampas Rem Depan Vario']);
    expect(d).toMatchObject({ serviceSubtotal: 35_000, partSubtotal: 130_000, total: 165_000 });
    const baris = await barisItemSpk(spk.number);
    expect(baris.map((i) => i.work_order_item_id)).toEqual(d.items.map((i: any) => i.itemId));
    expect(new Set(baris.map((i) => i.line_no)).size).toBe(3);
    harapTotalCocok(d);
  });
});

describe('POST /api/work-orders/{number}/items: sparepart dan stok', () => {
  it('harga dan nama dari katalog, price di badan diabaikan seluruhnya; stok berkurang; satu kartu USED', async () => {
    const part = await buatPart(b.pemilik.token, { name: 'Busi NGK CPR8', unit: 'pcs', price: 25_000, costPrice: 18_000, initialStock: 10 });
    const spk = await spkBaru();

    for (const price of [1, -5, 'abc', null, 1.5]) {
      harapStatus(await kirimItem(b.kasir.token, spk.number, { type: 'PART', partId: part.partId, quantity: 1, price }), 201);
    }
    const d = await detailSpk(b.kasir.token, spk.number);

    expect(d.items).toHaveLength(5);
    for (const i of d.items) {
      expect(i).toMatchObject({ type: 'PART', partId: part.partId, serviceId: null, name: 'Busi NGK CPR8', price: 25_000, quantity: 1, subtotal: 25_000 });
    }
    expect(await stokDb(part.partId)).toBe(5);
    expect((await barisItemSpk(spk.number)).map((i) => i.cost_price)).toEqual([18_000, 18_000, 18_000, 18_000, 18_000]);
    expect(await sparepartTidakCocokKartu()).toEqual([]);
  });

  it('kartu stok USED: jumlah negatif, stok sesudah, catatan kosong, SPK, dan staf; terbaca pemilik lewat API', async () => {
    const part = await buatPart(b.pemilik.token, { initialStock: 10 });
    const spk = await spkBaru();

    await tambahPart(b.kasir.token, spk.number, part.partId, 3);

    expect(await kartuSpk(part.partId, spk.number)).toMatchObject([
      { type: 'USED', quantity: -3, stock_after: 7, note: '', work_order_id: await idSpk(spk.number), staff_id: b.kasir.staff.staffId },
    ]);
    const used = (await pergerakanApi(b.pemilik.token, part.partId)).find((k) => k.type === 'USED');
    expect(used).toEqual({
      movementId: used.movementId,
      type: 'USED',
      quantity: -3,
      stockAfter: 7,
      note: '',
      workOrderNumber: spk.number,
      staff: ringkasStaf(b.kasir),
      createdAt: used.createdAt,
    });
  });

  it('dua item sparepart yang sama di satu SPK: dua item terpisah, stok berkurang dua kali, dua kartu USED', async () => {
    const part = await buatPart(b.pemilik.token, { initialStock: 10 });
    const spk = await spkBaru();

    await tambahPart(b.kasir.token, spk.number, part.partId, 2);
    const d = await tambahPart(b.kasir.token, spk.number, part.partId, 3);

    expect(d.items).toHaveLength(2);
    expect(d.items[0].itemId).not.toBe(d.items[1].itemId);
    expect(d.items.map((i: any) => i.quantity)).toEqual([2, 3]);
    expect(await stokDb(part.partId)).toBe(5);
    expect((await kartuSpk(part.partId, spk.number)).map((k) => [k.type, k.quantity, k.stock_after])).toEqual([
      ['USED', -2, 8],
      ['USED', -3, 5],
    ]);
  });

  it('stok tepat sama dengan jumlah → 201, stok 0; item berikutnya ditolak dengan tersedia 0', async () => {
    const part = await buatPart(b.pemilik.token, { name: 'Kampas Rem Depan Vario', unit: 'set', initialStock: 4 });
    const spk = await spkBaru();

    await tambahPart(b.kasir.token, spk.number, part.partId, 4);

    expect(await stokDb(part.partId)).toBe(0);
    harapStokKurang(await kirimItem(b.kasir.token, spk.number, { type: 'PART', partId: part.partId, quantity: 1 }), {
      name: 'Kampas Rem Depan Vario',
      unit: 'set',
      butuh: 1,
      tersedia: 0,
    });
  });

  it('jumlah lebih dari stok → 409 insufficient_stock dengan pesan baku; tidak ada yang berubah', async () => {
    const part = await buatPart(b.pemilik.token, { name: 'Kampas Rem Depan Vario', unit: 'set', initialStock: 2 });
    const spk = await spkBaru();
    const sebelum = await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId);
    const kartu = (await barisKartuStok(part.partId)).length;

    const res = await kirimItem(b.kasir.token, spk.number, { type: 'PART', partId: part.partId, quantity: 3 });

    harapStokKurang(res, { name: 'Kampas Rem Depan Vario', unit: 'set', butuh: 3, tersedia: 2 });
    expect(res.body.error.message).toBe('Stok sparepart tidak cukup: Kampas Rem Depan Vario (butuh 3 set, tersedia 2 set)');
    expect(await stokDb(part.partId)).toBe(2);
    expect((await barisKartuStok(part.partId)).length).toBe(kartu);
    harapSetara(await detailSpk(b.kasir.token, spk.number), sebelum);
  });

  it('stok yang dipakai item lain di SPK yang sama ikut dihitung: tersedia = sisa sesudah item pertama', async () => {
    const part = await buatPart(b.pemilik.token, { name: 'Baut M6', unit: 'pcs', initialStock: 10 });
    const spk = await spkBaru();
    await tambahPart(b.kasir.token, spk.number, part.partId, 7);

    harapStokKurang(await kirimItem(b.kasir.token, spk.number, { type: 'PART', partId: part.partId, quantity: 4 }), {
      name: 'Baut M6',
      unit: 'pcs',
      butuh: 4,
      tersedia: 3,
    });
    expect(await stokDb(part.partId)).toBe(3);
  });

  it('perubahan harga katalog sesudah item ditambahkan tidak mengubah item lama maupun harga belinya', async () => {
    const part = await buatPart(b.pemilik.token, { price: 55_000, costPrice: 40_000 });
    const jasa = await buatJasa(b.pemilik.token, { price: 50_000 });
    const spk = await spkBaru();
    await tambahJasa(b.kasir.token, spk.number, jasa.serviceId);
    await tambahPart(b.kasir.token, spk.number, part.partId, 1);

    harapStatus(await api.patch(`/api/parts/${part.partId}`, { token: b.pemilik.token, json: { price: 60_000, costPrice: 45_000, name: 'Nama Baru' } }), 200);
    harapStatus(await api.patch(`/api/services/${jasa.serviceId}`, { token: b.pemilik.token, json: { price: 52_000 } }), 200);
    const d = await tambahPart(b.kasir.token, spk.number, part.partId, 1);

    expect(d.items.map((i: any) => [i.name, i.price])).toEqual([
      [jasa.name, 50_000],
      [part.name, 55_000],
      ['Nama Baru', 60_000],
    ]);
    expect((await barisItemSpk(spk.number)).map((i) => i.cost_price)).toEqual([0, 40_000, 45_000]);
  });
});

describe('DELETE /api/work-orders/{number}/items/{itemId}', () => {
  it('menghapus item part: stok kembali sebesar jumlah item, satu kartu RETURNED (catatan kosong, staf penghapus), total dihitung ulang', async () => {
    const part = await buatPart(b.pemilik.token, { initialStock: 10 });
    const spk = await spkBaru();
    await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId);
    const isi = await tambahPart(b.kasir.token, spk.number, part.partId, 4);
    const itemPart = isi.items[1];

    const res = await kirimHapus(b.pemilik.token, spk.number, itemPart.itemId);

    harapStatus(res, 200);
    expect(res.body.data.items.map((i: any) => i.itemId)).toEqual([isi.items[0].itemId]);
    expect(res.body.data).toMatchObject({ serviceSubtotal: 35_000, partSubtotal: 0, total: 35_000 });
    expect(await stokDb(part.partId)).toBe(10);
    expect((await kartuSpk(part.partId, spk.number)).map((k) => [k.type, k.quantity, k.stock_after, k.note, k.staff_id])).toEqual([
      ['USED', -4, 6, '', b.kasir.staff.staffId],
      ['RETURNED', 4, 10, '', b.pemilik.staff.staffId],
    ]);
    const kembali = (await pergerakanApi(b.pemilik.token, part.partId)).find((k) => k.type === 'RETURNED');
    expect(kembali).toMatchObject({ quantity: 4, stockAfter: 10, note: '', workOrderNumber: spk.number, staff: ringkasStaf(b.pemilik) });
    expect(await sparepartTidakCocokKartu()).toEqual([]);
    harapSetara(await detailSpk(b.kasir.token, spk.number), res.body.data);
  });

  it('menghapus satu dari dua item part yang sama hanya mengembalikan jumlah item itu', async () => {
    const part = await buatPart(b.pemilik.token, { initialStock: 10 });
    const spk = await spkBaru();
    await tambahPart(b.kasir.token, spk.number, part.partId, 2);
    const d = await tambahPart(b.kasir.token, spk.number, part.partId, 5);

    await hapusItem(b.kasir.token, spk.number, d.items[1].itemId);

    expect(await stokDb(part.partId)).toBe(8);
    expect((await detailSpk(b.kasir.token, spk.number)).items.map((i: any) => i.quantity)).toEqual([2]);
  });

  it('menghapus item jasa tidak menyentuh stok; SPK tanpa item kembali bertotal 0 dan berstatus bayar paid', async () => {
    const spk = await spkBaru();
    const d = await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId);
    const stokOli = await stokDb(b.oli.partId);
    const kartu = (await barisKartuStok(b.oli.partId)).length;

    const res = await kirimHapus(b.kasir.token, spk.number, d.items[0].itemId);

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ items: [], total: 0, serviceSubtotal: 0, remainingAmount: 0, paymentStatus: 'paid' });
    expect(await stokDb(b.oli.partId)).toBe(stokOli);
    expect((await barisKartuStok(b.oli.partId)).length).toBe(kartu);
  });

  it('nomor baris item lain tidak bergeser sesudah item di tengah dihapus', async () => {
    const spk = await spkBaru();
    await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId);
    await tambahJasa(b.kasir.token, spk.number, b.cekKelistrikan.serviceId);
    const d = await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId, 2);
    const sebelum = await barisItemSpk(spk.number);

    await hapusItem(b.kasir.token, spk.number, d.items[1].itemId);

    const sesudah = await barisItemSpk(spk.number);
    expect(sesudah.map((i) => [i.work_order_item_id, i.line_no])).toEqual([sebelum[0], sebelum[2]].map((i) => [i!.work_order_item_id, i!.line_no]));
    expect((await detailSpk(b.kasir.token, spk.number)).items.map((i: any) => i.itemId)).toEqual([d.items[0].itemId, d.items[2].itemId]);
  });

  it('sparepart yang sudah nonaktif tetap menerima stoknya kembali saat item dihapus', async () => {
    const part = await buatPart(b.pemilik.token, { initialStock: 6 });
    const spk = await spkBaru();
    const d = await tambahPart(b.kasir.token, spk.number, part.partId, 6);
    await setAktif('parts', part.partId, false);

    harapStatus(await kirimHapus(b.kasir.token, spk.number, d.items[0].itemId), 200);

    expect(await stokDb(part.partId)).toBe(6);
    expect((await kartuSpk(part.partId, spk.number)).map((k) => k.type)).toEqual(['USED', 'RETURNED']);
  });
});

describe('Item SPK: updatedAt dan harga beli', () => {
  it('menambah dan menghapus item memperbarui updatedAt SPK', async () => {
    const spk = await spkBaru();
    await mundurkanUpdatedAt(spk.number);
    const d = await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId);
    expect(sesudahWaktuLama(d.updatedAt)).toBe(true);

    await mundurkanUpdatedAt(spk.number);
    const h = await hapusItem(b.kasir.token, spk.number, d.items[0].itemId);
    expect(sesudahWaktuLama(h.updatedAt)).toBe(true);
  });

  it('costPrice item tidak pernah muncul di respons tambah, hapus, maupun rincian, termasuk untuk pemilik', async () => {
    const spk = await spkBaru();

    for (const token of [b.pemilik.token, b.kasir.token]) {
      const tambah = await kirimItem(token, spk.number, { type: 'PART', partId: b.kampas.partId, quantity: 1 });
      harapStatus(tambah, 201);
      harapTanpaHargaBeli(tambah);
      harapTanpaHargaBeli(await ambilSpk(token, spk.number));
      const hapus = await kirimHapus(token, spk.number, tambah.body.data.items.at(-1).itemId);
      harapStatus(hapus, 200);
      harapTanpaHargaBeli(hapus);
    }
  });
});
