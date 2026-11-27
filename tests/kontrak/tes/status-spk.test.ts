// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// POST /api/work-orders/{number}/status. Perpindahan sah: QUEUED → IN_PROGRESS ⇄
// WAITING_PARTS, IN_PROGRESS → DONE (minimal satu item, keputusan 0a-4) → PICKED_UP
// (lunas). Selain itu 409 status_transition_invalid. Mekanik hanya menuju tiga status
// dan hanya SPK miliknya. Urutan: 413 → 400 → 401 → 404 → 403 (kepemilikan) → 422 →
// 403 (mekanik ke PICKED_UP) → 409 transisi → 409 work_order_empty / not_paid_off.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import { bayar, buatKasir, buatMekanik, buatSpk, detailSpk, siapkanBengkel, tambahJasa, tambahPart, type Bengkel, type SesiStaf } from '../src/data';
import { barisKartuStok, barisLogSpk, barisWaSpk } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { JSON_RUSAK, jsonLebihDariSatuMib, tokenAcak } from './pembantu-fondasi';
import { jumlahLog, jumlahWaSpk, kirimStatus, kirimUbah, ringkasStaf, spkDiStatus, statusDb, stokDb, type StatusSpk } from './pembantu-spk';

let b: Bengkel;
let kasirLain: SesiStaf;

beforeAll(async () => {
  b = await siapkanBengkel();
  kasirLain = await buatKasir({ name: 'Kasir Sore' });
});

const TUJUAN = ['IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP'] as const;
type Tujuan = (typeof TUJUAN)[number];

const SAH: Array<[StatusSpk, Tujuan]> = [
  ['QUEUED', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'WAITING_PARTS'],
  ['WAITING_PARTS', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'DONE'],
  ['DONE', 'PICKED_UP'],
];

const SEMUA: StatusSpk[] = ['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP', 'CANCELLED'];

// Setiap sel tabel (status sekarang × status tujuan) yang tidak tertulis di SAH.
const TIDAK_SAH: Array<[StatusSpk, Tujuan]> = SEMUA.flatMap((dari) =>
  TUJUAN.filter((ke) => !SAH.some(([d, k]) => d === dari && k === ke)).map((ke): [StatusSpk, Tujuan] => [dari, ke]),
);

describe('POST /api/work-orders/{number}/status: perpindahan sah (kasir)', () => {
  it.each(SAH)('%s → %s: 200, status berubah, satu baris linimasa dengan staf dan catatan dipangkas', async (dari, ke) => {
    const awal = await spkDiStatus(b, dari);
    if (ke === 'PICKED_UP') {
      await bayar(b.kasir.token, awal.number, awal.total);
    }
    const log = await jumlahLog(awal.number);

    const res = await kirimStatus(b.kasir.token, awal.number, { status: ke, note: '  Catatan langkah.  ' });

    harapStatus(res, 200);
    expect(res.body.data.status).toBe(ke);
    expect(res.body.data.timeline.at(-1)).toMatchObject({ fromStatus: dari, toStatus: ke, by: ringkasStaf(b.kasir), note: 'Catatan langkah.' });
    expect(await jumlahLog(awal.number)).toBe(log + 1);
    expect((await barisLogSpk(awal.number)).at(-1)).toMatchObject({ from_status: dari, to_status: ke, staff_id: b.kasir.staff.staffId, note: 'Catatan langkah.' });
    harapSetara(await detailSpk(b.kasir.token, awal.number), res.body.data);
  });

  it('jalur lengkap oleh beberapa staf: linimasa urut waktu dengan staf masing-masing, catatan bawaan kosong', async () => {
    const awal = await spkDiStatus(b, 'QUEUED', { mekanik: b.mekanik });

    harapStatus(await kirimStatus(b.mekanik.token, awal.number, { status: 'IN_PROGRESS' }), 200);
    harapStatus(await kirimStatus(b.mekanik.token, awal.number, { status: 'WAITING_PARTS', note: 'Kampas belum ada.' }), 200);
    harapStatus(await kirimStatus(kasirLain.token, awal.number, { status: 'IN_PROGRESS' }), 200);
    harapStatus(await kirimStatus(b.mekanik.token, awal.number, { status: 'DONE', note: ' \n ' }), 200);
    await bayar(b.kasir.token, awal.number, 35_000);
    const res = await kirimStatus(b.pemilik.token, awal.number, { status: 'PICKED_UP' });

    harapStatus(res, 200);
    expect(res.body.data.timeline.map((l: any) => [l.fromStatus, l.toStatus, l.by, l.note])).toEqual([
      [null, 'QUEUED', ringkasStaf(b.kasir), ''],
      ['QUEUED', 'IN_PROGRESS', ringkasStaf(b.mekanik), ''],
      ['IN_PROGRESS', 'WAITING_PARTS', ringkasStaf(b.mekanik), 'Kampas belum ada.'],
      ['WAITING_PARTS', 'IN_PROGRESS', ringkasStaf(kasirLain), ''],
      ['IN_PROGRESS', 'DONE', ringkasStaf(b.mekanik), ''],
      ['DONE', 'PICKED_UP', ringkasStaf(b.pemilik), ''],
    ]);
    const waktu = res.body.data.timeline.map((l: any) => Date.parse(l.createdAt));
    expect(waktu).toEqual([...waktu].sort((x, y) => x - y));
  });

  it('IN_PROGRESS dan WAITING_PARTS boleh bolak-balik berkali-kali', async () => {
    const awal = await spkDiStatus(b, 'IN_PROGRESS');
    for (const s of ['WAITING_PARTS', 'IN_PROGRESS', 'WAITING_PARTS', 'IN_PROGRESS']) {
      harapStatus(await kirimStatus(b.kasir.token, awal.number, { status: s }), 200);
    }
    expect(await jumlahLog(awal.number)).toBe(6);
  });

  it('catatan 200 karakter sah; field lain di badan diabaikan', async () => {
    const awal = await spkDiStatus(b, 'QUEUED');

    const res = await kirimStatus(b.kasir.token, awal.number, { status: 'IN_PROGRESS', note: 'n'.repeat(200), total: 1, paidAmount: 9, reason: 'x' });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ status: 'IN_PROGRESS', total: awal.total, paidAmount: 0 });
    expect(res.body.data.timeline.at(-1).note).toBe('n'.repeat(200));
  });

  it('perubahan status tidak menyentuh stok, item, maupun pembayaran', async () => {
    const awal = await spkDiStatus(b, 'QUEUED');
    await tambahPart(b.kasir.token, awal.number, b.kampas.partId, 2);
    const sebelum = await bayar(b.kasir.token, awal.number, 10_000);
    const stok = await stokDb(b.kampas.partId);
    const kartu = (await barisKartuStok(b.kampas.partId)).length;

    harapStatus(await kirimStatus(b.kasir.token, awal.number, { status: 'IN_PROGRESS' }), 200);
    const res = await kirimStatus(b.kasir.token, awal.number, { status: 'DONE' });

    expect(await stokDb(b.kampas.partId)).toBe(stok);
    expect((await barisKartuStok(b.kampas.partId)).length).toBe(kartu);
    const tanpaStatus = (s: any) => ({ ...s, status: '-', timeline: [], wa: null, updatedAt: '-' });
    harapSetara(tanpaStatus(res.body.data), tanpaStatus(sebelum));
  });
});

describe('POST /api/work-orders/{number}/status: perpindahan tidak sah → 409 status_transition_invalid', () => {
  it.each(TIDAK_SAH)('%s → %s', async (dari, ke) => {
    const awal = await spkDiStatus(b, dari);
    const log = await jumlahLog(awal.number);

    harapGalat(await kirimStatus(b.kasir.token, awal.number, { status: ke }), 409, 'status_transition_invalid');

    expect(await statusDb(awal.number)).toBe(dari);
    expect(await jumlahLog(awal.number)).toBe(log);
  });

  it('transisi dinilai lebih dulu dari work_order_empty: QUEUED atau WAITING_PARTS tanpa item → DONE tetap status_transition_invalid', async () => {
    for (const dari of ['QUEUED', 'WAITING_PARTS'] as StatusSpk[]) {
      const awal = await spkDiStatus(b, dari, { item: false });
      harapGalat(await kirimStatus(b.kasir.token, awal.number, { status: 'DONE' }), 409, 'status_transition_invalid');
    }
  });

  it('transisi dinilai lebih dulu dari not_paid_off: IN_PROGRESS belum lunas → PICKED_UP tetap status_transition_invalid', async () => {
    const awal = await spkDiStatus(b, 'IN_PROGRESS');

    harapGalat(await kirimStatus(b.kasir.token, awal.number, { status: 'PICKED_UP' }), 409, 'status_transition_invalid');
  });
});

describe('POST /api/work-orders/{number}/status: DONE butuh item, PICKED_UP butuh lunas', () => {
  it('IN_PROGRESS tanpa item → DONE: 409 work_order_empty; tidak ada linimasa dan tidak ada WhatsApp', async () => {
    const awal = await spkDiStatus(b, 'IN_PROGRESS', { item: false });
    const wa = await jumlahWaSpk(awal.number);

    harapGalat(await kirimStatus(b.kasir.token, awal.number, { status: 'DONE' }), 409, 'work_order_empty');

    expect(await statusDb(awal.number)).toBe('IN_PROGRESS');
    expect(await jumlahLog(awal.number)).toBe(2);
    expect(await jumlahWaSpk(awal.number)).toBe(wa);
  });

  it('DONE belum bayar atau baru dibayar sebagian → PICKED_UP: 409 not_paid_off; lunas → 200', async () => {
    const awal = await spkDiStatus(b, 'DONE');

    harapGalat(await kirimStatus(b.kasir.token, awal.number, { status: 'PICKED_UP' }), 409, 'not_paid_off');
    await bayar(b.kasir.token, awal.number, 35_000 - 1);
    harapGalat(await kirimStatus(b.kasir.token, awal.number, { status: 'PICKED_UP' }), 409, 'not_paid_off');
    expect(await statusDb(awal.number)).toBe('DONE');
    await bayar(b.kasir.token, awal.number, 1);

    const res = await kirimStatus(b.kasir.token, awal.number, { status: 'PICKED_UP' });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ status: 'PICKED_UP', paymentStatus: 'paid', remainingAmount: 0 });
  });

  it('SPK bertotal 0 (jasa diberi harga 0) boleh DONE lalu langsung diambil tanpa pembayaran', async () => {
    const awal = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);
    await tambahJasa(b.kasir.token, awal.number, b.cekKelistrikan.serviceId, 1, 0);
    harapStatus(await kirimStatus(b.kasir.token, awal.number, { status: 'IN_PROGRESS' }), 200);
    harapStatus(await kirimStatus(b.kasir.token, awal.number, { status: 'DONE' }), 200);

    const res = await kirimStatus(b.kasir.token, awal.number, { status: 'PICKED_UP' });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ status: 'PICKED_UP', total: 0, paidAmount: 0, paymentStatus: 'paid', payments: [] });
  });
});

describe('POST /api/work-orders/{number}/status: mekanik', () => {
  it('mekanik pemilik SPK boleh menuju IN_PROGRESS, WAITING_PARTS, dan DONE', async () => {
    const awal = await spkDiStatus(b, 'QUEUED', { mekanik: b.mekanik });

    for (const s of ['IN_PROGRESS', 'WAITING_PARTS', 'IN_PROGRESS', 'DONE']) {
      const res = await kirimStatus(b.mekanik.token, awal.number, { status: s });
      harapStatus(res, 200);
      expect(res.body.data.timeline.at(-1)).toMatchObject({ toStatus: s, by: ringkasStaf(b.mekanik) });
    }
  });

  it('mekanik menuju PICKED_UP → 403, walau SPK miliknya sudah DONE dan lunas', async () => {
    const awal = await spkDiStatus(b, 'DONE', { mekanik: b.mekanik });
    await bayar(b.kasir.token, awal.number, awal.total);

    harapGalat(await kirimStatus(b.mekanik.token, awal.number, { status: 'PICKED_UP' }), 403, 'forbidden');
    expect(await statusDb(awal.number)).toBe('DONE');
  });

  it('403 PICKED_UP lebih dulu dari 409: mekanik pada SPK miliknya yang masih QUEUED atau belum lunas → 403', async () => {
    const antre = await spkDiStatus(b, 'QUEUED', { mekanik: b.mekanik });
    const selesai = await spkDiStatus(b, 'DONE', { mekanik: b.mekanik });

    harapGalat(await kirimStatus(b.mekanik.token, antre.number, { status: 'PICKED_UP' }), 403, 'forbidden');
    harapGalat(await kirimStatus(b.mekanik.token, selesai.number, { status: 'PICKED_UP' }), 403, 'forbidden');
  });

  it('422 lebih dulu dari 403 PICKED_UP: catatan terlalu panjang dengan tujuan PICKED_UP → 422', async () => {
    const awal = await spkDiStatus(b, 'DONE', { mekanik: b.mekanik });

    harapGalat(await kirimStatus(b.mekanik.token, awal.number, { status: 'PICKED_UP', note: 'n'.repeat(201) }), 422, 'validation_failed', {
      note: 'too_long',
    });
  });

  it('mekanik: perpindahan tidak sah → 409, SPK miliknya tanpa item → work_order_empty', async () => {
    const antre = await spkDiStatus(b, 'QUEUED', { mekanik: b.mekanik });
    const kosong = await spkDiStatus(b, 'IN_PROGRESS', { mekanik: b.mekanik, item: false });

    harapGalat(await kirimStatus(b.mekanik.token, antre.number, { status: 'DONE' }), 409, 'status_transition_invalid');
    harapGalat(await kirimStatus(b.mekanik.token, kosong.number, { status: 'DONE' }), 409, 'work_order_empty');
  });

  it('SPK milik mekanik lain atau tanpa mekanik → 403, juga dengan badan tidak valid (403 kepemilikan lebih dulu dari 422)', async () => {
    const lain = await buatMekanik({ name: 'Mekanik Lain' });
    const punyaLain = await spkDiStatus(b, 'QUEUED', { mekanik: lain });
    const tanpa = await spkDiStatus(b, 'QUEUED');

    for (const n of [punyaLain.number, tanpa.number]) {
      harapGalat(await kirimStatus(b.mekanik.token, n, { status: 'IN_PROGRESS' }), 403, 'forbidden');
      harapGalat(await kirimStatus(b.mekanik.token, n, { status: 'salah' }), 403, 'forbidden');
      expect(await statusDb(n)).toBe('QUEUED');
    }
  });

  it('SPK yang dipindah ke mekanik lain tidak bisa lagi diubah mekanik lama', async () => {
    const lain = await buatMekanik({ name: 'Mekanik Pengganti' });
    const awal = await spkDiStatus(b, 'QUEUED', { mekanik: b.mekanik });
    harapStatus(await kirimUbah(b.kasir.token, awal.number, { mechanicId: lain.staff.staffId }), 200);

    harapGalat(await kirimStatus(b.mekanik.token, awal.number, { status: 'IN_PROGRESS' }), 403, 'forbidden');
    harapStatus(await kirimStatus(lain.token, awal.number, { status: 'IN_PROGRESS' }), 200);
  });

  it('404 lebih dulu dari 403: mekanik dengan nomor yang tidak ada → 404', async () => {
    harapGalat(await kirimStatus(b.mekanik.token, 'S-999999', { status: 'IN_PROGRESS' }), 404, 'not_found');
  });
});

describe('POST /api/work-orders/{number}/status: validasi badan', () => {
  it.each<[string, Record<string, unknown>, Record<string, string>]>([
    ['status tidak dikirim', {}, { status: 'required' }],
    ['status null', { status: null }, { status: 'required' }],
    ['status kosong', { status: '' }, { status: 'required' }],
    ['status angka', { status: 1 }, { status: 'invalid_type' }],
    ['status larik', { status: ['DONE'] }, { status: 'invalid_type' }],
    ['status huruf kecil', { status: 'in_progress' }, { status: 'invalid_format' }],
    ['status spasi di akhir', { status: 'IN_PROGRESS ' }, { status: 'invalid_format' }],
    ['status hanya spasi', { status: '  ' }, { status: 'invalid_format' }],
    ['status QUEUED (tidak bisa dituju)', { status: 'QUEUED' }, { status: 'invalid_format' }],
    ['status CANCELLED (pembatalan lewat /cancel)', { status: 'CANCELLED' }, { status: 'invalid_format' }],
    ['note null', { status: 'IN_PROGRESS', note: null }, { note: 'invalid_type' }],
    ['note angka', { status: 'IN_PROGRESS', note: 5 }, { note: 'invalid_type' }],
    ['note 201 karakter', { status: 'IN_PROGRESS', note: 'é'.repeat(201) }, { note: 'too_long' }],
    ['status dan note salah sekaligus', { status: 'x', note: null }, { status: 'invalid_format', note: 'invalid_type' }],
  ])('%s → 422; status tidak berubah', async (_nama, json, fields) => {
    const awal = await spkDiStatus(b, 'QUEUED');

    harapGalat(await kirimStatus(b.kasir.token, awal.number, json), 422, 'validation_failed', fields);
    expect(await statusDb(awal.number)).toBe('QUEUED');
  });

  it('422 lebih dulu dari 409: status tak sah pada SPK PICKED_UP atau CANCELLED tetap 422', async () => {
    const diambil = await spkDiStatus(b, 'PICKED_UP');
    const batal = await spkDiStatus(b, 'CANCELLED');

    harapGalat(await kirimStatus(b.kasir.token, diambil.number, { status: 'QUEUED' }), 422, 'validation_failed', { status: 'invalid_format' });
    harapGalat(await kirimStatus(b.kasir.token, batal.number, {}), 422, 'validation_failed', { status: 'required' });
  });
});

describe('POST /api/work-orders/{number}/status: urutan 413 → 400 → 401 → 404', () => {
  it('413 dan 400 lebih dulu dari 401 dan 404', async () => {
    harapGalat(await api.post('/api/work-orders/S-999999/status', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    for (const mentah of [JSON_RUSAK, '[]', 'true', '']) {
      harapGalat(await api.post('/api/work-orders/S-999999/status', { mentah }), 400, 'bad_request');
    }
  });

  it('401 lebih dulu dari 404 dan 422', async () => {
    const awal = await spkDiStatus(b, 'QUEUED');

    harapGalat(await kirimStatus('', 'S-999999', {}), 401, 'unauthenticated');
    harapGalat(await kirimStatus(tokenAcak(), awal.number, { status: 'IN_PROGRESS' }), 401, 'unauthenticated');
    expect(await statusDb(awal.number)).toBe('QUEUED');
  });

  it('nomor tidak ada atau bentuk lain → 404, lebih dulu dari 422', async () => {
    const awal = await spkDiStatus(b, 'QUEUED');

    for (const n of ['S-999999', awal.number.toLowerCase(), 'S-1']) {
      harapGalat(await kirimStatus(b.kasir.token, n, {}), 404, 'not_found');
    }
  });
});

describe('POST /api/work-orders/{number}/status: WhatsApp dan permintaan serentak', () => {
  it('hanya perpindahan ke DONE yang mengirim WhatsApp (work_order_done); status lain tidak', async () => {
    const awal = await spkDiStatus(b, 'QUEUED');
    const wa = await jumlahWaSpk(awal.number);

    for (const s of ['IN_PROGRESS', 'WAITING_PARTS', 'IN_PROGRESS']) {
      harapStatus(await kirimStatus(b.kasir.token, awal.number, { status: s }), 200);
    }
    expect(await jumlahWaSpk(awal.number)).toBe(wa);

    const selesai = await kirimStatus(b.kasir.token, awal.number, { status: 'DONE' });
    expect(await jumlahWaSpk(awal.number)).toBe(wa + 1);
    expect((await barisWaSpk(awal.number, 'work_order_done')).map((w) => w.status)).toEqual(['sent']);
    expect(selesai.body.data.wa.workOrderDone.status).toBe('sent');

    await bayar(b.kasir.token, awal.number, awal.total);
    harapStatus(await kirimStatus(b.kasir.token, awal.number, { status: 'PICKED_UP' }), 200);
    expect(await jumlahWaSpk(awal.number)).toBe(wa + 1);
  });

  it('dua permintaan serentak untuk langkah yang sama → tepat satu 200 dan satu 409; satu baris linimasa', async () => {
    const awal = await spkDiStatus(b, 'QUEUED');

    const semua = await Promise.all([
      kirimStatus(b.kasir.token, awal.number, { status: 'IN_PROGRESS' }),
      kirimStatus(kasirLain.token, awal.number, { status: 'IN_PROGRESS' }),
    ]);

    expect(semua.map((r) => r.status).sort()).toEqual([200, 409]);
    harapGalat(semua.find((r) => r.status === 409)!, 409, 'status_transition_invalid');
    expect((await barisLogSpk(awal.number)).filter((l) => l.to_status === 'IN_PROGRESS')).toHaveLength(1);
  });
});
