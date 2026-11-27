// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// POST /api/work-orders/{number}/payments: pembayaran dicatat kasir, boleh
// dicicil sejak SPK dibuat, tidak pernah melebihi sisa tagihan, tidak mengubah
// status, stok, maupun mengirim WhatsApp. Status bayar turunan unpaid →
// partial → paid. SPK berisi di sini = Ganti Oli + Oli = Rp90.000.
// Pembayaran serentak ada di serentak.test.ts.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import { bayar, buatKasir, detailSpk, lunasi, siapkanBengkel, spkBengkel, spkBerisi, tambahJasa, ubahStatus, type Bengkel, type SesiStaf } from '../src/data';
import { aturWaktuPembayaran, barisKartuStok, barisPart, barisWaSpk } from '../src/db';
import { statusBayar } from '../src/format';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { waPalsu } from '../src/wa';
import { jsonLebihDariSatuMib, JSON_RUSAK } from './pembantu-fondasi';
import { keStatus, kirimBayar, POLA_UUID, ringkasStaf, ringkasUangDb, selisihSekarangMs, TOTAL_BERISI, type StatusSpk } from './pembantu-uang';

let b: Bengkel;
let kasirLain: SesiStaf;

beforeAll(async () => {
  b = await siapkanBengkel();
  kasirLain = await buatKasir({ name: 'Kasir Sore' });
});

// token null = tanpa token. Bukan undefined: undefined memicu nilai bawaan parameter.
function catat(nomor: string, json: unknown, token: string | null = b.kasir.token): Promise<Respons> {
  return kirimBayar(token ?? undefined, nomor, json);
}

function catatMentah(nomor: string, mentah: string, token: string | null = b.kasir.token): Promise<Respons> {
  return api.post(`/api/work-orders/${nomor}/payments`, { token: token ?? undefined, mentah });
}

// SPK berisi Rp90.000 di status tertentu (PICKED_UP sudah lunas).
async function spkDi(status: StatusSpk, opsi: { denganMekanik?: boolean } = {}): Promise<any> {
  return keStatus(b, await spkBerisi(b, opsi), status);
}

const TANPA_BAYAR = { paid: 0, jumlah: 0, baris: 0 };

describe('POST /api/work-orders/{number}/payments: berhasil', () => {
  it('uang muka di SPK QUEUED → 201 partial; pelunasan pemilik → paid; tiap baris memuat metode, jumlah, pencatat, dan waktu', async () => {
    const spk = await spkBerisi(b);
    expect(spk).toMatchObject({ total: TOTAL_BERISI, paidAmount: 0, remainingAmount: TOTAL_BERISI, paymentStatus: 'unpaid', status: 'QUEUED' });

    const muka = await catat(spk.number, { amount: 20_000, method: 'cash' });

    harapStatus(muka, 201);
    expect(muka.body.data).toMatchObject({
      number: spk.number,
      status: 'QUEUED',
      total: TOTAL_BERISI,
      paidAmount: 20_000,
      remainingAmount: 70_000,
      paymentStatus: 'partial',
    });
    expect(muka.body.data.payments).toHaveLength(1);
    const pertama = muka.body.data.payments[0];
    expect(pertama).toMatchObject({ amount: 20_000, method: 'cash', recordedBy: ringkasStaf(b.kasir) });
    expect(pertama.paymentId).toMatch(POLA_UUID);
    expect(selisihSekarangMs(pertama.createdAt)).toBeLessThan(60_000);
    expect(Date.parse(muka.body.data.updatedAt)).toBeGreaterThan(Date.parse(spk.updatedAt));
    expect(muka.body.data.timeline).toHaveLength(spk.timeline.length);

    const lunas = await catat(spk.number, { amount: 70_000, method: 'qris' }, b.pemilik.token);

    harapStatus(lunas, 201);
    expect(lunas.body.data).toMatchObject({ paidAmount: TOTAL_BERISI, remainingAmount: 0, paymentStatus: 'paid', status: 'QUEUED' });
    expect(lunas.body.data.payments.map((p: any) => [p.amount, p.method, p.recordedBy])).toEqual(
      expect.arrayContaining([
        [20_000, 'cash', ringkasStaf(b.kasir)],
        [70_000, 'qris', ringkasStaf(b.pemilik)],
      ]),
    );
    expect(lunas.body.data.payments).toHaveLength(2);
    expect(await ringkasUangDb(spk.number)).toEqual({ paid: TOTAL_BERISI, jumlah: TOTAL_BERISI, baris: 2 });
    harapSetara(await detailSpk(b.kasir.token, spk.number), lunas.body.data);
  });

  it('cicilan tiga kali dari dua kasir: unpaid → partial → partial → paid, paidAmount dan remainingAmount menjumlah', async () => {
    const spk = await spkBerisi(b);

    const hasil: Respons[] = [];
    hasil.push(await catat(spk.number, { amount: 10_000, method: 'cash' }));
    hasil.push(await catat(spk.number, { amount: 30_000, method: 'transfer' }, kasirLain.token));
    hasil.push(await catat(spk.number, { amount: 50_000, method: 'qris' }));

    expect(hasil.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(hasil.map((r) => [r.body.data.paidAmount, r.body.data.remainingAmount, r.body.data.paymentStatus, r.body.data.payments.length])).toEqual([
      [10_000, 80_000, 'partial', 1],
      [40_000, 50_000, 'partial', 2],
      [TOTAL_BERISI, 0, 'paid', 3],
    ]);
    expect(await ringkasUangDb(spk.number)).toEqual({ paid: TOTAL_BERISI, jumlah: TOTAL_BERISI, baris: 3 });
  });

  it('kurang Rp1 dari total masih partial; Rp1 terakhir menjadikannya paid', async () => {
    const spk = await spkBerisi(b);

    const hampir = await catat(spk.number, { amount: TOTAL_BERISI - 1, method: 'cash' });
    const lunas = await catat(spk.number, { amount: 1, method: 'cash' });

    expect(hampir.body.data).toMatchObject({ paidAmount: TOTAL_BERISI - 1, remainingAmount: 1, paymentStatus: 'partial' });
    expect(lunas.body.data).toMatchObject({ paidAmount: TOTAL_BERISI, remainingAmount: 0, paymentStatus: 'paid' });
  });

  it.each(['cash', 'transfer', 'qris'])('metode %s diterima dan tersimpan apa adanya', async (method) => {
    const spk = await spkBerisi(b);

    const res = await catat(spk.number, { amount: 1000, method });

    harapStatus(res, 201);
    expect(res.body.data.payments[0].method).toBe(method);
  });

  it.each<StatusSpk>(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE'])('SPK %s boleh dibayar; status dan linimasa tidak berubah', async (status) => {
    const spk = await spkDi(status);

    const res = await catat(spk.number, { amount: 1000, method: 'cash' });

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ status, paidAmount: 1000, paymentStatus: 'partial' });
    harapSetara(res.body.data.timeline, spk.timeline);
  });

  it('daftar pembayaran urut createdAt naik, lalu paymentId naik bila waktunya sama', async () => {
    const spk = await spkBerisi(b);
    await bayar(b.kasir.token, spk.number, 1000);
    await bayar(b.kasir.token, spk.number, 2000);
    const dibayar = await bayar(b.kasir.token, spk.number, 3000);
    const id = (jumlah: number): string => dibayar.payments.find((p: any) => p.amount === jumlah).paymentId;
    await aturWaktuPembayaran(id(3000), '2026-10-01 10:00:00.000');
    await aturWaktuPembayaran(id(1000), '2026-10-02 10:00:00.000');
    await aturWaktuPembayaran(id(2000), '2026-10-02 10:00:00.000');

    const detail = await detailSpk(b.kasir.token, spk.number);

    expect(detail.payments.map((p: any) => p.paymentId)).toEqual([id(3000), ...[id(1000), id(2000)].sort()]);
  });

  it('jumlah 1000.0 dan 1.5e4 sah sebagai integer', async () => {
    const satu = await spkBerisi(b);
    const dua = await spkBerisi(b);

    const a = await catatMentah(satu.number, '{"amount":1000.0,"method":"cash"}');
    const c = await catatMentah(dua.number, '{"amount":1.5e4,"method":"cash"}');

    harapStatus(a, 201);
    harapStatus(c, 201);
    expect([a.body.data.paidAmount, c.body.data.paidAmount]).toEqual([1000, 15_000]);
  });

  it('field lain di badan diabaikan (recordedBy, paidAmount, status, change)', async () => {
    const spk = await spkBerisi(b);

    const res = await catat(spk.number, { amount: 1000, method: 'cash', change: 500, paidAmount: 90_000, status: 'PICKED_UP', recordedBy: 'orang lain' });

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ status: 'QUEUED', paidAmount: 1000, total: TOTAL_BERISI });
    expect(res.body.data.payments[0].recordedBy).toEqual(ringkasStaf(b.kasir));
  });

  it('pembayaran tidak menyentuh stok dan tidak mengirim WhatsApp', async () => {
    const spk = await spkBerisi(b);
    const stok = (await barisPart(b.oli.partId)).stock;
    const kartu = (await barisKartuStok(b.oli.partId)).length;
    const pesan = (await waPalsu.untuk(b.pelanggan.phone)).length;
    const baris = (await barisWaSpk(spk.number)).length;

    harapStatus(await catat(spk.number, { amount: TOTAL_BERISI, method: 'cash' }), 201);

    expect((await barisPart(b.oli.partId)).stock).toBe(stok);
    expect(await barisKartuStok(b.oli.partId)).toHaveLength(kartu);
    expect(await waPalsu.untuk(b.pelanggan.phone)).toHaveLength(pesan);
    expect(await barisWaSpk(spk.number)).toHaveLength(baris);
  });

  it('menambah item sesudah lunas membuka sisa baru: paid → partial, lalu sisa itu boleh dibayar', async () => {
    const spk = await lunasi(b.kasir.token, await spkBerisi(b));
    expect(spk.paymentStatus).toBe('paid');

    const tambah = await tambahJasa(b.kasir.token, spk.number, b.cekKelistrikan.serviceId);

    expect(tambah).toMatchObject({ total: 140_000, paidAmount: TOTAL_BERISI, remainingAmount: 50_000, paymentStatus: 'partial' });
    const res = await catat(spk.number, { amount: 50_000, method: 'transfer' });
    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ paidAmount: 140_000, remainingAmount: 0, paymentStatus: 'paid' });
  });

  it('paymentStatus selalu sama dengan turunan dari total dan paidAmount', async () => {
    const spk = await spkBerisi(b);
    const urutan = [await detailSpk(b.kasir.token, spk.number), await bayar(b.kasir.token, spk.number, 45_000), await bayar(b.kasir.token, spk.number, 45_000)];

    for (const d of urutan) {
      expect(d.paymentStatus).toBe(statusBayar(d.total, d.paidAmount));
      expect(d.remainingAmount).toBe(d.total - d.paidAmount);
    }
  });
});

describe('SPK bertotal 0 (keputusan 0a-14) dan penyerahan kendaraan', () => {
  it('SPK tanpa item: total 0 berstatus paid dengan sisa 0, jadi pembayaran apa pun → 422 amount out_of_range', async () => {
    const spk = await spkBengkel(b);
    expect(spk).toMatchObject({ total: 0, paidAmount: 0, remainingAmount: 0, paymentStatus: 'paid' });

    harapGalat(await catat(spk.number, { amount: 1, method: 'cash' }), 422, 'validation_failed', { amount: 'out_of_range' });
    expect(await ringkasUangDb(spk.number)).toEqual(TANPA_BAYAR);
  });

  it('SPK berisi jasa gratis (Rp0): paid sejak awal dan boleh langsung diambil tanpa pembayaran', async () => {
    const spk = await spkBengkel(b);
    await tambahJasa(b.kasir.token, spk.number, b.gantiOli.serviceId, 1, 0);
    await ubahStatus(b.kasir.token, spk.number, 'IN_PROGRESS');
    const selesai = await ubahStatus(b.kasir.token, spk.number, 'DONE');
    expect(selesai).toMatchObject({ total: 0, paymentStatus: 'paid' });

    const res = await api.post(`/api/work-orders/${spk.number}/status`, { token: b.kasir.token, json: { status: 'PICKED_UP' } });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ status: 'PICKED_UP', paidAmount: 0, payments: [] });
  });

  it('PICKED_UP hanya bila lunas: bayar sebagian → 409 not_paid_off; sesudah lunas → 200', async () => {
    const spk = await spkDi('DONE');
    await bayar(b.kasir.token, spk.number, 50_000);

    harapGalat(
      await api.post(`/api/work-orders/${spk.number}/status`, { token: b.kasir.token, json: { status: 'PICKED_UP' } }),
      409,
      'not_paid_off',
    );
    await bayar(b.kasir.token, spk.number, 40_000);
    expect((await ubahStatus(b.kasir.token, spk.number, 'PICKED_UP')).status).toBe('PICKED_UP');
  });
});

describe('POST /api/work-orders/{number}/payments: melebihi sisa → 422 amount out_of_range', () => {
  it('lebih dari sisa ditolak, tepat sisa diterima, sesudah lunas apa pun ditolak; tidak ada baris tambahan', async () => {
    const spk = await spkBerisi(b);
    await bayar(b.kasir.token, spk.number, 5000);

    harapGalat(await catat(spk.number, { amount: 85_001, method: 'cash' }), 422, 'validation_failed', { amount: 'out_of_range' });
    harapStatus(await catat(spk.number, { amount: 85_000, method: 'cash' }), 201);
    harapGalat(await catat(spk.number, { amount: 1, method: 'cash' }), 422, 'validation_failed', { amount: 'out_of_range' });
    expect(await ringkasUangDb(spk.number)).toEqual({ paid: TOTAL_BERISI, jumlah: TOTAL_BERISI, baris: 2 });
  });

  it('SPK DONE yang sudah lunas menolak pembayaran', async () => {
    const spk = await lunasi(b.kasir.token, await spkDi('DONE'));

    harapGalat(await catat(spk.number, { amount: 1, method: 'qris' }), 422, 'validation_failed', { amount: 'out_of_range' });
  });

  it('angka terbesar yang sah (2^53−1) tetap melebihi sisa → out_of_range, tanpa pembayaran tercatat', async () => {
    const spk = await spkBerisi(b);

    harapGalat(await catat(spk.number, { amount: 9_007_199_254_740_991, method: 'cash' }), 422, 'validation_failed', { amount: 'out_of_range' });
    expect(await ringkasUangDb(spk.number)).toEqual(TANPA_BAYAR);
  });
});

describe('POST /api/work-orders/{number}/payments: 409 dan urutannya', () => {
  it('SPK CANCELLED → 409 work_order_cancelled, dinilai sebelum batas sisa tagihan', async () => {
    const spk = await spkDi('CANCELLED');

    harapGalat(await catat(spk.number, { amount: 1000, method: 'cash' }), 409, 'work_order_cancelled');
    harapGalat(await catat(spk.number, { amount: 999_999_999, method: 'cash' }), 409, 'work_order_cancelled');
    expect(await ringkasUangDb(spk.number)).toEqual(TANPA_BAYAR);
  });

  it('SPK PICKED_UP (sisa 0) → 409 already_picked_up, bukan 422 sisa tagihan', async () => {
    const spk = await spkDi('PICKED_UP');
    const sebelum = await ringkasUangDb(spk.number);

    harapGalat(await catat(spk.number, { amount: 1, method: 'cash' }), 409, 'already_picked_up');
    harapGalat(await catat(spk.number, { amount: 500_000, method: 'transfer' }), 409, 'already_picked_up');
    expect(await ringkasUangDb(spk.number)).toEqual(sebelum);
  });

  it('validasi field (422) mendahului 409', async () => {
    const batal = await spkDi('CANCELLED');
    const diambil = await spkDi('PICKED_UP');

    harapGalat(await catat(batal.number, { amount: 0, method: 'cash' }), 422, 'validation_failed', { amount: 'out_of_range' });
    harapGalat(await catat(batal.number, {}), 422, 'validation_failed', { amount: 'required', method: 'required' });
    harapGalat(await catat(diambil.number, { amount: 1000, method: 'debit' }), 422, 'validation_failed', { method: 'invalid_format' });
  });
});

describe('POST /api/work-orders/{number}/payments: validasi', () => {
  it.each<[string, Record<string, unknown>, Record<string, string>]>([
    ['tidak dikirim', {}, { amount: 'required', method: 'required' }],
    ['null', { amount: null, method: null }, { amount: 'required', method: 'required' }],
    ['tipe salah', { amount: '1000', method: 1 }, { amount: 'invalid_type', method: 'invalid_type' }],
    ['amount boolean', { amount: true, method: 'cash' }, { amount: 'invalid_type' }],
    ['amount larik', { amount: [1000], method: 'cash' }, { amount: 'invalid_type' }],
    ['amount pecahan', { amount: 1000.5, method: 'cash' }, { amount: 'invalid_type' }],
    ['amount nol', { amount: 0, method: 'cash' }, { amount: 'out_of_range' }],
    ['amount negatif', { amount: -1000, method: 'cash' }, { amount: 'out_of_range' }],
    ['method huruf besar', { amount: 1000, method: 'CASH' }, { method: 'invalid_format' }],
    ['method tidak dikenal', { amount: 1000, method: 'debit' }, { method: 'invalid_format' }],
    ['method berspasi (pilihan tetap tidak dipangkas)', { amount: 1000, method: ' cash' }, { method: 'invalid_format' }],
    ['method hanya spasi', { amount: 1000, method: '  ' }, { method: 'invalid_format' }],
    ['method kosong', { amount: 1000, method: '' }, { method: 'required' }],
    ['method objek', { amount: 1000, method: { cash: true } }, { method: 'invalid_type' }],
  ])('%s → 422, tanpa pembayaran tercatat', async (_nama, json, fields) => {
    const spk = await spkBerisi(b);

    harapGalat(await catat(spk.number, json), 422, 'validation_failed', fields);
    expect(await ringkasUangDb(spk.number)).toEqual(TANPA_BAYAR);
  });

  it.each<[string, string]>([
    ['1e400', '1e400'],
    ['2^53+1', '9007199254740993'],
    ['-(2^53+1)', '-9007199254740993'],
  ])('amount %s (nilai mutlak di atas 2^53−1) → out_of_range', async (_nama, angka) => {
    const spk = await spkBerisi(b);

    harapGalat(await catatMentah(spk.number, `{"amount":${angka},"method":"cash"}`), 422, 'validation_failed', { amount: 'out_of_range' });
  });
});

describe('POST /api/work-orders/{number}/payments: urutan 413 → 400 → 401 → 403 → 404 → 422', () => {
  it('badan lebih dari 1 MiB → 413; badan bukan objek JSON → 400; keduanya sebelum 401 dan 404', async () => {
    harapGalat(await catatMentah('S-9999', jsonLebihDariSatuMib(), null), 413, 'payload_too_large');
    for (const mentah of [JSON_RUSAK, '[]', 'null', '"1000"', '1000', '']) {
      harapGalat(await catatMentah('S-9999', mentah, null), 400, 'bad_request');
      harapGalat(await catatMentah('S-9999', mentah, b.mekanik.token), 400, 'bad_request');
    }
  });

  it('tanpa token atau token tak dikenal → 401, sebelum 403 dan 404', async () => {
    const spk = await spkBerisi(b);

    harapGalat(await catat('S-9999', { amount: 1000, method: 'cash' }, null), 401, 'unauthenticated');
    harapGalat(await catat(spk.number, { amount: 1000, method: 'cash' }, 'x'.repeat(43)), 401, 'unauthenticated');
  });

  it('mekanik → 403, juga untuk SPK miliknya, nomor yang tidak ada, dan badan tidak sah; tidak ada yang tercatat', async () => {
    const milik = await spkBerisi(b, { denganMekanik: true });

    harapGalat(await catat(milik.number, { amount: 1000, method: 'cash' }, b.mekanik.token), 403, 'forbidden');
    harapGalat(await catat('S-9999', { amount: 1000, method: 'cash' }, b.mekanik.token), 403, 'forbidden');
    harapGalat(await catat(milik.number, { amount: 0 }, b.mekanik.token), 403, 'forbidden');
    expect(await ringkasUangDb(milik.number)).toEqual(TANPA_BAYAR);
  });

  it('nomor tidak ada atau berbentuk lain → 404, sebelum 422', async () => {
    const spk = await spkBerisi(b);

    harapGalat(await catat('S-9999', { amount: 0 }), 404, 'not_found');
    harapGalat(await catat(spk.number.toLowerCase(), { amount: 1000, method: 'cash' }), 404, 'not_found');
    harapGalat(await catat('S-1', { amount: 1000, method: 'cash' }), 404, 'not_found');
    expect(await ringkasUangDb(spk.number)).toEqual(TANPA_BAYAR);
  });
});
