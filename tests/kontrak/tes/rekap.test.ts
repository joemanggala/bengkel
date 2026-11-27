// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// GET /api/reports/daily?date=YYYY-MM-DD (khusus pemilik). Angka dihitung
// tangan dari definisi skema RekapHarian dan keputusan 0a-9: nilai, modal,
// laba, dan terlaris dari SPK yang baris linimasa DONE-nya jatuh di tanggal
// itu; "SPK masuk" dari created_at (status sekarang bukan CANCELLED); uang
// diterima dari tanggal pembayaran. Semua waktu UTC ditetapkan langsung di
// database lewat helper, jadi tidak bergantung pada jam saat tes berjalan.
// Tanggal WIB D = [D−1 17:00:00.000, D 17:00:00.000) UTC.

import { beforeAll, describe, expect, it } from 'vitest';
import {
  batalkanSpk,
  bayar,
  buatJasa,
  buatMekanik,
  buatPart,
  buatSpk,
  namaUnik,
  siapkanBengkel,
  tambahJasa,
  tambahPart,
  ubahStatus,
  wajib,
  type Bengkel,
  type SesiStaf,
} from '../src/data';
import { aturWaktuLogSpk, aturWaktuPembayaran, aturWaktuSpk } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { pembayaranBaru, ringkasStaf } from './pembantu-uang';

type Metode = 'cash' | 'transfer' | 'qris';
interface Item {
  jasa?: any;
  part?: any;
  qty: number;
  // Harga lain untuk jasa (opsional).
  price?: number;
}
interface Rencana {
  mekanik?: SesiStaf;
  item: Item[];
  dibuat: string;
  bayar?: Array<[number, Metode, string]>;
  selesai?: string;
  diambil?: string;
  batal?: string;
}

let b: Bengkel;

// Menyusun satu SPK sesuai rencana, lalu menetapkan semua waktunya (UTC).
async function susun(r: Rencana): Promise<string> {
  const t = b.kasir.token;
  let spk = await buatSpk(t, b.kendaraan.vehicleId, r.mekanik ? { mechanicId: r.mekanik.staff.staffId } : {});
  const n = spk.number;
  for (const i of r.item) {
    spk = i.jasa ? await tambahJasa(t, n, i.jasa.serviceId, i.qty, i.price) : await tambahPart(t, n, i.part.partId, i.qty);
  }
  for (const [jumlah, metode, waktu] of r.bayar ?? []) {
    const sesudah = await bayar(t, n, jumlah, metode);
    await aturWaktuPembayaran(pembayaranBaru(spk, sesudah).paymentId, waktu);
    spk = sesudah;
  }
  if (r.selesai) {
    await ubahStatus(t, n, 'IN_PROGRESS');
    await ubahStatus(t, n, 'DONE');
    await aturWaktuLogSpk(n, 'DONE', r.selesai);
  }
  if (r.diambil) {
    await ubahStatus(t, n, 'PICKED_UP');
    await aturWaktuLogSpk(n, 'PICKED_UP', r.diambil);
  }
  if (r.batal) {
    await batalkanSpk(t, n);
    await aturWaktuLogSpk(n, 'CANCELLED', r.batal);
  }
  await aturWaktuSpk(n, r.dibuat);
  return n;
}

async function rekap(date: string): Promise<any> {
  return wajib(await api.get('/api/reports/daily', { token: b.pemilik.token, query: { date } }), 200).body.data;
}

const NOL = {
  workOrderCount: 0,
  doneCount: 0,
  pickedUpCount: 0,
  cancelledCount: 0,
  serviceTotal: 0,
  partTotal: 0,
  salesTotal: 0,
  partCostTotal: 0,
  grossProfit: 0,
  partItemsWithoutCost: 0,
  paymentTotal: 0,
  paymentsByMethod: { cash: 0, transfer: 0, qris: 0 },
  topServices: [],
  topParts: [],
  doneByMechanic: [],
};

const servis = (j: any, quantity: number, revenue: number) => ({ serviceId: j.serviceId, name: j.name, quantity, revenue });
const sparepart = (p: any, quantity: number, revenue: number, cost: number) => ({ partId: p.partId, name: p.name, quantity, revenue, cost, profit: revenue - cost });

beforeAll(async () => {
  b = await siapkanBengkel();
});

describe('GET /api/reports/daily: tanggal tanpa data', () => {
  it('semua angka 0 dan daftar kosong, bukan 404', async () => {
    expect(await rekap('2001-01-01')).toEqual({ date: '2001-01-01', ...NOL });
  });
});

describe('GET /api/reports/daily: satu hari lengkap beserta batas tanggal WIB', () => {
  // D = 2026-03-10: [2026-03-09T17:00Z, 2026-03-10T17:00Z).
  let adi: SesiStaf;
  let budi: SesiStaf;
  let jasaOli: any;
  let jasaCek: any;
  let oli: any;
  let kampas: any;
  let busi: any;

  beforeAll(async () => {
    const p = b.pemilik.token;
    adi = await buatMekanik({ name: 'Adi Mekanik' });
    budi = await buatMekanik({ name: 'Budi Mekanik' });
    jasaOli = await buatJasa(p, { name: namaUnik('Ganti Oli Rekap'), price: 35_000 });
    jasaCek = await buatJasa(p, { name: namaUnik('Cek Kelistrikan Rekap'), price: 50_000, isPublic: false });
    oli = await buatPart(p, { name: namaUnik('Oli Rekap'), price: 55_000, costPrice: 40_000, initialStock: 50 });
    kampas = await buatPart(p, { name: namaUnik('Kampas Rekap'), price: 75_000, costPrice: 50_000, initialStock: 20 });
    busi = await buatPart(p, { name: namaUnik('Busi Rekap'), price: 20_000, costPrice: 0, initialStock: 50 });

    // A: dibuat, selesai, dibayar dua kali, dan diambil di D.
    await susun({
      mekanik: adi,
      item: [{ jasa: jasaOli, qty: 1 }, { part: oli, qty: 2 }],
      dibuat: '2026-03-10T01:00:00.000Z',
      bayar: [
        [50_000, 'cash', '2026-03-10T02:00:00.000Z'],
        [95_000, 'qris', '2026-03-10T08:00:00.000Z'],
      ],
      selesai: '2026-03-10T07:00:00.000Z',
      diambil: '2026-03-10T09:00:00.000Z',
    });
    // B: dibuat di milidetik terakhir D−1, selesai tepat 17:00 UTC (awal D); busi tanpa harga beli dua baris.
    await susun({
      item: [{ jasa: jasaCek, qty: 1, price: 60_000 }, { part: kampas, qty: 1 }, { part: busi, qty: 2 }, { part: busi, qty: 1 }],
      dibuat: '2026-03-09T16:59:59.999Z',
      bayar: [[20_000, 'transfer', '2026-03-09T16:59:59.999Z']],
      selesai: '2026-03-09T17:00:00.000Z',
    });
    // C: dibuat di D, belum selesai, uang muka di D (termasuk milidetik terakhir D).
    await susun({
      mekanik: adi,
      item: [{ jasa: jasaOli, qty: 2 }],
      dibuat: '2026-03-10T03:00:00.000Z',
      bayar: [
        [10_000, 'cash', '2026-03-10T04:00:00.000Z'],
        [5000, 'qris', '2026-03-10T16:59:59.999Z'],
      ],
    });
    // D: dibuat dan dibatalkan di D.
    await susun({ item: [{ part: kampas, qty: 1 }], dibuat: '2026-03-10T05:00:00.000Z', batal: '2026-03-10T06:00:00.000Z' });
    // E: dibuat 5 Maret, selesai di milidetik terakhir D, dibayar dan diambil D+1.
    await susun({
      mekanik: budi,
      item: [{ part: oli, qty: 1 }],
      dibuat: '2026-03-05T02:00:00.000Z',
      selesai: '2026-03-10T16:59:59.999Z',
      bayar: [[55_000, 'transfer', '2026-03-11T01:00:00.000Z']],
      diambil: '2026-03-11T02:00:00.000Z',
    });
    // F: dibuat di D, selesai tepat 17:00 UTC (= 00:00 WIB D+1).
    await susun({ mekanik: budi, item: [{ jasa: jasaOli, qty: 1 }], dibuat: '2026-03-10T10:00:00.000Z', selesai: '2026-03-10T17:00:00.000Z' });
    // G: dibuat dan selesai di D dengan harga jasa lain, dibayar tepat 17:00 UTC (D+1).
    await susun({
      mekanik: budi,
      item: [{ jasa: jasaOli, qty: 1, price: 40_000 }],
      dibuat: '2026-03-10T11:00:00.000Z',
      selesai: '2026-03-10T12:00:00.000Z',
      bayar: [[40_000, 'cash', '2026-03-10T17:00:00.000Z']],
    });
    // H: dibuat di D, dibatalkan di D+1.
    await susun({ item: [{ jasa: jasaOli, qty: 1 }], dibuat: '2026-03-10T13:00:00.000Z', batal: '2026-03-11T03:00:00.000Z' });

    // Sesudah semua SPK selesai: nama jasa dan sparepart diganti (rekap memakai
    // nama saat ini), dan harga beli oli diganti (rekap memakai harga beli saat
    // part ditambahkan).
    jasaOli = wajib(await api.patch(`/api/services/${jasaOli.serviceId}`, { token: p, json: { name: `${jasaOli.name} Baru` } }), 200).body.data;
    oli = wajib(await api.patch(`/api/parts/${oli.partId}`, { token: p, json: { name: `${oli.name} Baru`, costPrice: 45_000 } }), 200).body.data;
  });

  it('D: setiap angka sesuai definisi, termasuk laba kotor, catatan harga beli belum lengkap, dan urutan daftar', async () => {
    expect(await rekap('2026-03-10')).toEqual({
      date: '2026-03-10',
      // A, C, F, G (B dibuat D−1, E dibuat 5 Maret; SPK batal D dan H tidak dihitung).
      workOrderCount: 4,
      // A, B (17:00:00.000 UTC D−1), E (16:59:59.999 UTC D), G; F jatuh di D+1.
      doneCount: 4,
      pickedUpCount: 1,
      cancelledCount: 1,
      serviceTotal: 35_000 + 60_000 + 40_000,
      partTotal: 110_000 + 135_000 + 55_000,
      salesTotal: 435_000,
      // Oli 3 × 40.000 (harga beli saat ditambahkan, bukan 45.000) + kampas 50.000 + busi 0.
      partCostTotal: 170_000,
      grossProfit: 265_000,
      // Dua baris busi berharga beli 0 di B.
      partItemsWithoutCost: 2,
      paymentTotal: 160_000,
      paymentsByMethod: { cash: 60_000, transfer: 0, qris: 100_000 },
      topServices: [servis(jasaOli, 2, 75_000), servis(jasaCek, 1, 60_000)],
      // Oli dan busi sama-sama 3: oli lebih dulu karena revenue lebih besar.
      topParts: [sparepart(oli, 3, 165_000, 120_000), sparepart(busi, 3, 60_000, 0), sparepart(kampas, 1, 75_000, 50_000)],
      doneByMechanic: [
        { mechanic: ringkasStaf(budi), doneCount: 2 },
        { mechanic: ringkasStaf(adi), doneCount: 1 },
        { mechanic: null, doneCount: 1 },
      ],
    });
  });

  it('D−1: SPK B masuk dan pembayaran di milidetik terakhir D−1 dihitung; B selesai di D, jadi nilainya tidak ikut', async () => {
    expect(await rekap('2026-03-09')).toEqual({
      ...NOL,
      date: '2026-03-09',
      workOrderCount: 1,
      paymentTotal: 20_000,
      paymentsByMethod: { cash: 0, transfer: 20_000, qris: 0 },
    });
  });

  it('D+1: F selesai tepat 17:00 UTC, E diambil, H dibatalkan, dan pembayaran tepat 17:00 UTC', async () => {
    expect(await rekap('2026-03-11')).toEqual({
      ...NOL,
      date: '2026-03-11',
      doneCount: 1,
      pickedUpCount: 1,
      cancelledCount: 1,
      serviceTotal: 35_000,
      salesTotal: 35_000,
      grossProfit: 35_000,
      paymentTotal: 95_000,
      paymentsByMethod: { cash: 40_000, transfer: 55_000, qris: 0 },
      topServices: [servis(jasaOli, 1, 35_000)],
      doneByMechanic: [{ mechanic: ringkasStaf(budi), doneCount: 1 }],
    });
  });

  it('tanggal SPK dibuat (5 Maret) hanya menghitung SPK masuk; nilainya ada di tanggal selesai (keputusan 0a-9)', async () => {
    expect(await rekap('2026-03-05')).toEqual({ ...NOL, date: '2026-03-05', workOrderCount: 1 });
  });

  it('paymentsByMethod selalu berjumlah paymentTotal dan salesTotal = serviceTotal + partTotal', async () => {
    for (const date of ['2026-03-09', '2026-03-10', '2026-03-11']) {
      const r = await rekap(date);
      expect(r.paymentsByMethod.cash + r.paymentsByMethod.transfer + r.paymentsByMethod.qris).toBe(r.paymentTotal);
      expect(r.salesTotal).toBe(r.serviceTotal + r.partTotal);
      expect(r.grossProfit).toBe(r.salesTotal - r.partCostTotal);
    }
  });
});

describe('GET /api/reports/daily: modal, laba negatif, dan terlaris', () => {
  it('modal memakai harga beli saat part ditambahkan; laba kotor dan profit part boleh negatif', async () => {
    const p = b.pemilik.token;
    const aki = await buatPart(p, { name: namaUnik('Aki Rekap'), price: 300_000, costPrice: 350_000, initialStock: 5 });
    const jasa = await buatJasa(p, { name: namaUnik('Pasang Aki'), price: 0 });
    const n = await susun({ item: [{ jasa, qty: 1 }, { part: aki, qty: 1 }], dibuat: '2026-04-01T02:00:00.000Z' });
    wajib(await api.patch(`/api/parts/${aki.partId}`, { token: p, json: { costPrice: 100_000 } }), 200);
    await ubahStatus(b.kasir.token, n, 'IN_PROGRESS');
    await ubahStatus(b.kasir.token, n, 'DONE');
    await aturWaktuLogSpk(n, 'DONE', '2026-04-01T03:00:00.000Z');
    wajib(await api.patch(`/api/parts/${aki.partId}`, { token: p, json: { costPrice: 1 } }), 200);

    const r = await rekap('2026-04-01');

    expect(r).toMatchObject({ doneCount: 1, serviceTotal: 0, partTotal: 300_000, partCostTotal: 350_000, grossProfit: -50_000, partItemsWithoutCost: 0 });
    expect(r.topParts).toEqual([sparepart(aki, 1, 300_000, 350_000)]);
    expect(r.topParts[0].profit).toBe(-50_000);
    expect(r.topServices).toEqual([servis(jasa, 1, 0)]);
  });

  it('terlaris paling banyak 5: urut quantity turun, revenue turun, lalu ID naik', async () => {
    const p = b.pemilik.token;
    const harga = [10_000, 50_000, 20_000, 10_000, 10_000, 5000];
    const jumlah = [3, 2, 2, 1, 1, 1];
    const jasa: any[] = [];
    const part: any[] = [];
    for (const h of harga) {
      jasa.push(await buatJasa(p, { name: namaUnik('Jasa Laris'), price: h }));
      part.push(await buatPart(p, { name: namaUnik('Part Laris'), price: h, costPrice: 1000, initialStock: 10 }));
    }
    await susun({
      item: harga.flatMap((_h, i) => [
        { jasa: jasa[i], qty: jumlah[i]! },
        { part: part[i], qty: jumlah[i]! },
      ]),
      dibuat: '2026-04-02T01:00:00.000Z',
      selesai: '2026-04-02T02:00:00.000Z',
    });

    const r = await rekap('2026-04-02');

    const urutId = <T>(a: T, c: T, kunci: (x: T) => string): [T, T] => (kunci(a) < kunci(c) ? [a, c] : [c, a]);
    const [j4, j5] = urutId(jasa[3], jasa[4], (x: any) => x.serviceId);
    const [p4, p5] = urutId(part[3], part[4], (x: any) => x.partId);
    expect(r.topServices).toEqual([servis(jasa[0], 3, 30_000), servis(jasa[1], 2, 100_000), servis(jasa[2], 2, 40_000), servis(j4, 1, 10_000), servis(j5, 1, 10_000)]);
    expect(r.topParts).toEqual([
      sparepart(part[0], 3, 30_000, 3000),
      sparepart(part[1], 2, 100_000, 2000),
      sparepart(part[2], 2, 40_000, 2000),
      sparepart(p4, 1, 10_000, 1000),
      sparepart(p5, 1, 10_000, 1000),
    ]);
    expect(r.partItemsWithoutCost).toBe(0);
  });

  it('SPK selesai per mekanik: jumlah sama urut nama naik lalu staffId naik; baris tanpa mekanik selalu terakhir', async () => {
    const jasa = await buatJasa(b.pemilik.token, { name: namaUnik('Jasa Mekanik'), price: 10_000 });
    const mekanik = [
      await buatMekanik({ name: 'Sama Nama' }),
      await buatMekanik({ name: 'budi kecil' }),
      await buatMekanik({ name: 'Sama Nama' }),
      await buatMekanik({ name: 'Ani Mekanik' }),
    ];
    for (const m of [undefined, ...mekanik]) {
      await susun({ mekanik: m, item: [{ jasa, qty: 1 }], dibuat: '2026-04-03T01:00:00.000Z', selesai: '2026-04-03T02:00:00.000Z' });
    }

    const r = await rekap('2026-04-03');

    const sama = [mekanik[0]!, mekanik[2]!].map(ringkasStaf).sort((x, y) => (x.staffId < y.staffId ? -1 : 1));
    expect(r.doneByMechanic).toEqual([
      { mechanic: ringkasStaf(mekanik[3]!), doneCount: 1 },
      { mechanic: ringkasStaf(mekanik[1]!), doneCount: 1 },
      { mechanic: sama[0], doneCount: 1 },
      { mechanic: sama[1], doneCount: 1 },
      { mechanic: null, doneCount: 1 },
    ]);
    expect(r.doneCount).toBe(5);
  });

  it('SPK yang dibatalkan dengan item part tidak menyumbang nilai, modal, maupun terlaris; hanya cancelledCount', async () => {
    const part = await buatPart(b.pemilik.token, { name: namaUnik('Part Batal'), costPrice: 0, initialStock: 5 });
    await susun({ item: [{ part, qty: 2 }], dibuat: '2026-04-04T01:00:00.000Z', batal: '2026-04-04T02:00:00.000Z' });

    expect(await rekap('2026-04-04')).toEqual({ ...NOL, date: '2026-04-04', cancelledCount: 1 });
  });
});

describe('GET /api/reports/daily: validasi date dan urutan pemeriksaan', () => {
  it('date tidak dikirim → 422 required', async () => {
    harapGalat(await api.get('/api/reports/daily', { token: b.pemilik.token }), 422, 'validation_failed', { date: 'required' });
  });

  it.each([
    ['kosong', ''],
    ['bukan tanggal', 'kemarin'],
    ['tanggal 30 Februari', '2026-02-30'],
    ['29 Februari tahun bukan kabisat', '2026-02-29'],
    ['bulan 13', '2026-13-01'],
    ['hari 00', '2026-11-00'],
    ['tanpa nol di depan', '2026-1-05'],
    ['dengan jam', '2026-11-27T00:00:00Z'],
    ['format DD-MM-YYYY', '27-11-2026'],
    ['spasi di akhir (+ di query = spasi)', '2026-11-27+'],
    ['titik koma adalah data', '2026-11-27;x=1'],
    ['sebelum 1000-01-02', '1000-01-01'],
    ['tahun lima digit', '10000-01-01'],
  ])('date %s → 422 invalid_format', async (_nama, nilai) => {
    harapGalat(await api.get(`/api/reports/daily?date=${nilai}`, { token: b.pemilik.token }), 422, 'validation_failed', { date: 'invalid_format' });
  });

  it.each(['1000-01-02', '9999-12-31', '2028-02-29'])('date %s (batas rentang dan tahun kabisat) → 200', async (date) => {
    const res = await api.get('/api/reports/daily', { token: b.pemilik.token, query: { date } });

    harapStatus(res, 200);
    expect(res.body.data.date).toBe(date);
  });

  it('urutan 401 → 403 → 422: tanpa token 401, kasir dan mekanik 403 walau date tidak sah', async () => {
    harapGalat(await api.get('/api/reports/daily?date=salah'), 401, 'unauthenticated');
    harapGalat(await api.get('/api/reports/daily?date=salah', { token: b.kasir.token }), 403, 'forbidden');
    harapGalat(await api.get('/api/reports/daily', { token: b.mekanik.token }), 403, 'forbidden');
    harapGalat(await api.get('/api/reports/daily?date=2026-03-10', { token: b.kasir.token }), 403, 'forbidden');
  });
});
