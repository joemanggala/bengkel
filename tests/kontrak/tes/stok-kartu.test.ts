// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// GET /api/parts/{partId}/movements (khusus pemilik): kartu stok satu sparepart. Tiap baris memuat
// jenis, perubahan bertanda, stok sesudahnya, catatan, nomor SPK penyebabnya (hanya USED dan
// RETURNED), dan staf pelakunya. Urut createdAt terbaru dulu, lalu movementId turun. Jumlah semua
// quantity kartu stok selalu sama dengan stok sparepart.

import { beforeAll, describe, expect, it } from 'vitest';
import {
  batalkanSpk,
  buatKasir,
  buatMekanik,
  buatPart,
  buatPelangganDenganKendaraan,
  buatPemilik,
  buatSpk,
  hapusItem,
  hitungStok,
  stokKeluar,
  stokMasuk,
  tambahPart,
  type SesiStaf,
} from '../src/data';
import { barisPart, sparepartTidakCocokKartu } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { type Respons } from '../src/klien';
import { ID_TAK_ADA, idDianggapTakAda, type Query, urutId } from './pembantu-pelanggan';
import { aturWaktuKartu, kirimKartu, ringkasStaf, satuKartuDb, ubahPart } from './pembantu-stok';

let pemilik: SesiStaf;
let kasir: SesiStaf;
let mekanik: SesiStaf;
let vehicleId: string;

beforeAll(async () => {
  pemilik = await buatPemilik();
  kasir = await buatKasir();
  mekanik = await buatMekanik();
  vehicleId = (await buatPelangganDenganKendaraan(kasir.token)).kendaraan.vehicleId;
});

function kartu(partId: string, query: Query | string = {}, token: string | null = pemilik.token): Promise<Respons> {
  return kirimKartu(token, partId, query);
}

function idDari(res: Respons): string[] {
  return res.body.data.map((x: any) => x.movementId);
}

type Pencocok = (k: { type: string; note: string; quantity: number }) => boolean;

// Menetapkan waktu baris menurut urutan kronologisnya (satu menit berselang), supaya urutan di API
// tidak bergantung pada kecepatan backend menulis created_at. Mengembalikan movementId dari yang
// terlama.
async function aturUrutan(partId: string, pencocok: Pencocok[]): Promise<string[]> {
  const id: string[] = [];
  for (const [i, cocok] of pencocok.entries()) {
    const movementId = await satuKartuDb(partId, cocok);
    await aturWaktuKartu(movementId, `2026-03-10 10:${String(i).padStart(2, '0')}:00.000`);
    id.push(movementId);
  }
  return id;
}

describe('GET /api/parts/{partId}/movements', () => {
  it('sparepart tanpa pergerakan → 200 dengan data kosong dan meta bawaan', async () => {
    const p = await buatPart(pemilik.token, { initialStock: 0 });

    const res = await kartu(p.partId);

    harapStatus(res, 200);
    expect(res.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it('isi tiap jenis (IN, OUT, COUNT, USED, RETURNED): jumlah bertanda, stok sesudah, catatan, nomor SPK, dan staf pelaku; terbaru dulu', async () => {
    const p = await buatPart(pemilik.token, { initialStock: 13 });
    const id = p.partId;
    await stokMasuk(pemilik.token, id, 5, { note: 'Belanja' });
    await stokKeluar(pemilik.token, id, 2, 'Rusak');
    await hitungStok(pemilik.token, id, 15, 'Opname');
    // Item part ditambah kasir lalu dihapus pemilik; item kedua kembali karena SPK dibatalkan pemilik.
    const spk = await buatSpk(kasir.token, vehicleId);
    const berisi = await tambahPart(kasir.token, spk.number, id, 3);
    await hapusItem(pemilik.token, spk.number, berisi.items[0].itemId);
    await tambahPart(kasir.token, spk.number, id, 2);
    await batalkanSpk(pemilik.token, spk.number);
    const kronologi = await aturUrutan(id, [
      (k) => k.note === 'Stok awal',
      (k) => k.note === 'Belanja',
      (k) => k.type === 'OUT',
      (k) => k.type === 'COUNT',
      (k) => k.type === 'USED' && k.quantity === -3,
      (k) => k.type === 'RETURNED' && k.quantity === 3,
      (k) => k.type === 'USED' && k.quantity === -2,
      (k) => k.type === 'RETURNED' && k.quantity === 2,
    ]);

    const res = await kartu(id);

    harapStatus(res, 200);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 8 });
    expect(idDari(res)).toEqual([...kronologi].reverse());
    const pmk = ringkasStaf(pemilik);
    const ksr = ringkasStaf(kasir);
    const harapan = [
      { type: 'IN', quantity: 13, stockAfter: 13, note: 'Stok awal', workOrderNumber: null, staff: pmk },
      { type: 'IN', quantity: 5, stockAfter: 18, note: 'Belanja', workOrderNumber: null, staff: pmk },
      { type: 'OUT', quantity: -2, stockAfter: 16, note: 'Rusak', workOrderNumber: null, staff: pmk },
      { type: 'COUNT', quantity: -1, stockAfter: 15, note: 'Opname', workOrderNumber: null, staff: pmk },
      { type: 'USED', quantity: -3, stockAfter: 12, note: '', workOrderNumber: spk.number, staff: ksr },
      { type: 'RETURNED', quantity: 3, stockAfter: 15, note: '', workOrderNumber: spk.number, staff: pmk },
      { type: 'USED', quantity: -2, stockAfter: 13, note: '', workOrderNumber: spk.number, staff: ksr },
      { type: 'RETURNED', quantity: 2, stockAfter: 15, note: '', workOrderNumber: spk.number, staff: pmk },
    ];
    const kronologis = [...res.body.data].reverse();
    for (const [i, baris] of kronologis.entries()) {
      expect(baris, `baris ke-${i}`).toEqual({ movementId: kronologi[i], ...harapan[i], createdAt: baris.createdAt });
    }
    expect((await barisPart(id)).stock).toBe(15);
  });

  it('stockAfter konsisten: dari yang terlama, tiap baris = stok baris sebelumnya + jumlahnya; baris terakhir = stok sekarang', async () => {
    const p = await buatPart(pemilik.token, { initialStock: 40 });
    const id = p.partId;
    await stokMasuk(pemilik.token, id, 10, { note: 'Belanja' });
    await stokKeluar(pemilik.token, id, 25, 'Rusak');
    await hitungStok(pemilik.token, id, 7, 'Hitung');
    await stokMasuk(pemilik.token, id, 3, { note: 'Susulan' });
    await aturUrutan(id, [(k) => k.note === 'Stok awal', (k) => k.note === 'Belanja', (k) => k.type === 'OUT', (k) => k.type === 'COUNT', (k) => k.note === 'Susulan']);

    const res = await kartu(id);

    const kronologis = [...res.body.data].reverse();
    let stok = 0;
    for (const baris of kronologis) {
      stok += baris.quantity;
      expect(baris.stockAfter, `${baris.type} ${baris.quantity}`).toBe(stok);
      expect(baris.stockAfter).toBeGreaterThanOrEqual(0);
    }
    expect(kronologis.map((x: any) => x.stockAfter)).toEqual([40, 50, 25, 7, 10]);
    expect((await barisPart(id)).stock).toBe(10);
  });

  it('waktu sama dipisahkan movementId turun; waktu berbeda urut terbaru dulu', async () => {
    const p = await buatPart(pemilik.token, { initialStock: 1 });
    const id = p.partId;
    await stokMasuk(pemilik.token, id, 1, { note: 'Satu' });
    await stokMasuk(pemilik.token, id, 2, { note: 'Dua' });
    await stokMasuk(pemilik.token, id, 3, { note: 'Tiga' });
    const lama = await satuKartuDb(id, (k) => k.note === 'Stok awal');
    await aturWaktuKartu(lama, '2026-03-10 09:00:00.000');
    const kembar: string[] = [];
    for (const note of ['Satu', 'Dua', 'Tiga']) {
      const movementId = await satuKartuDb(id, (k) => k.note === note);
      await aturWaktuKartu(movementId, '2026-03-10 10:00:00.000');
      kembar.push(movementId);
    }

    const res = await kartu(id);

    expect(idDari(res)).toEqual([...kembar.sort((a, b) => urutId(b, a)), lama]);
  });

  it('paginasi: halaman bersambung tanpa celah, total tidak ikut terpotong, halaman di luar isi → data kosong', async () => {
    const p = await buatPart(pemilik.token, { initialStock: 10 });
    const id = p.partId;
    for (let i = 1; i <= 6; i += 1) {
      await stokMasuk(pemilik.token, id, i, { note: `Belanja ${i}` });
    }
    const kronologi = await aturUrutan(id, [(k) => k.note === 'Stok awal', ...[1, 2, 3, 4, 5, 6].map((i): Pencocok => (k) => k.note === `Belanja ${i}`)]);
    const terbaru = [...kronologi].reverse();

    const gabungan: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await kartu(id, { page, limit: 3 });

      harapStatus(res, 200);
      expect(res.body.meta).toEqual({ page, limit: 3, total: 7 });
      expect(res.body.data).toHaveLength(page === 3 ? 1 : 3);
      gabungan.push(...idDari(res));
    }

    expect(gabungan).toEqual(terbaru);
    expect((await kartu(id, { page: 4, limit: 3 })).body).toEqual({ data: [], meta: { page: 4, limit: 3, total: 7 } });
    expect((await kartu(id, { page: 1_000_000 })).body).toEqual({ data: [], meta: { page: 1_000_000, limit: 20, total: 7 } });
    expect(idDari(await kartu(id, { limit: 50 }))).toEqual(terbaru);
  });

  it('kartu tiap sparepart terpisah: pergerakan sparepart lain tidak ikut tampil', async () => {
    const a = await buatPart(pemilik.token, { initialStock: 5 });
    const b = await buatPart(pemilik.token, { initialStock: 9 });
    await stokMasuk(pemilik.token, a.partId, 1);
    await stokKeluar(pemilik.token, b.partId, 2);

    const kartuA = (await kartu(a.partId)).body.data.map((x: any) => `${x.type} ${x.quantity}`);
    const kartuB = (await kartu(b.partId)).body.data.map((x: any) => `${x.type} ${x.quantity}`);

    expect(kartuA.sort()).toEqual(['IN 1', 'IN 5']);
    expect(kartuB.sort()).toEqual(['IN 9', 'OUT -2']);
  });

  it('sparepart nonaktif: kartunya tetap bisa dibaca dan tetap menerima stok kembali dari SPK', async () => {
    const p = await buatPart(pemilik.token, { initialStock: 5 });
    const spk = await buatSpk(kasir.token, vehicleId);
    const berisi = await tambahPart(kasir.token, spk.number, p.partId, 2);
    await ubahPart(pemilik.token, p.partId, { isActive: false });

    await hapusItem(kasir.token, spk.number, berisi.items[0].itemId);

    const res = await kartu(p.partId);
    harapStatus(res, 200);
    expect(res.body.meta.total).toBe(3);
    const kembali = res.body.data.find((x: any) => x.type === 'RETURNED');
    expect(kembali).toMatchObject({ quantity: 2, stockAfter: 5, workOrderNumber: spk.number, staff: ringkasStaf(kasir) });
    expect(await barisPart(p.partId)).toMatchObject({ stock: 5, is_active: false });
  });

  it('jumlah semua quantity kartu stok sama dengan stok, untuk setiap sparepart di berkas ini', async () => {
    expect(await sparepartTidakCocokKartu()).toEqual([]);
  });
});

describe('GET /api/parts/{partId}/movements: validasi dan urutan pemeriksaan', () => {
  it.each([
    ['page=0', 'page=0', { page: 'out_of_range' }],
    ['page=1000001', 'page=1000001', { page: 'out_of_range' }],
    ['page kosong', 'page=', { page: 'invalid_format' }],
    ['page negatif', 'page=-1', { page: 'invalid_format' }],
    ['page pecahan', 'page=1.5', { page: 'invalid_format' }],
    ['limit=0', 'limit=0', { limit: 'out_of_range' }],
    ['limit=51', 'limit=51', { limit: 'out_of_range' }],
    ['limit huruf', 'limit=abc', { limit: 'invalid_format' }],
    ['page dan limit sekaligus', 'page=0&limit=abc', { page: 'out_of_range', limit: 'invalid_format' }],
  ])('%s → 422', async (_judul, query, fields) => {
    const p = await buatPart(pemilik.token, { initialStock: 1 });

    harapGalat(await kartu(p.partId, query), 422, 'validation_failed', fields);
  });

  it('urutan: 401 → 403 (kasir dan mekanik) → 404 (tidak ada, huruf besar, bukan UUID) → 422', async () => {
    const p = await buatPart(pemilik.token, { initialStock: 1 });

    harapGalat(await kartu(ID_TAK_ADA, 'page=0', null), 401, 'unauthenticated');
    harapGalat(await kartu(p.partId, '', 'x'.repeat(43)), 401, 'unauthenticated');
    for (const sesi of [kasir, mekanik]) {
      harapGalat(await kartu(ID_TAK_ADA, 'page=0', sesi.token), 403, 'forbidden');
      harapGalat(await kartu(p.partId, '', sesi.token), 403, 'forbidden');
    }
    for (const id of idDianggapTakAda(p.partId)) {
      harapGalat(await kartu(id, 'page=0'), 404, 'not_found');
    }
    harapGalat(await kartu(p.partId, 'page=0'), 422, 'validation_failed', { page: 'out_of_range' });
  });
});
