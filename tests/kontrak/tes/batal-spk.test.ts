// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// POST /api/work-orders/{number}/cancel: alasan wajib, hanya dari QUEUED, IN_PROGRESS,
// atau WAITING_PARTS, ditolak bila sudah ada pembayaran, dan semua part kembali ke stok
// (satu kartu RETURNED per sparepart). Urutan: 413 → 400 → 401 → 403 → 404 → 422 →
// 409 status_transition_invalid → 409 has_payments → 200.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import { bayar, buatKasir, buatPart, buatSpk, detailSpk, hapusItem, siapkanBengkel, tambahJasa, tambahPart, type Bengkel, type SesiStaf } from '../src/data';
import { barisLogSpk, barisSpk, idSpk, setAktif, sparepartTidakCocokKartu } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { JSON_RUSAK, jsonLebihDariSatuMib, tokenAcak } from './pembantu-fondasi';
import { jumlahLog, jumlahWaSpk, kartuSpk, kirimBatal, kirimStatus, ringkasStaf, spkDiStatus, statusDb, stokDb, type StatusSpk } from './pembantu-spk';

let b: Bengkel;
let kasirLain: SesiStaf;

beforeAll(async () => {
  b = await siapkanBengkel();
  kasirLain = await buatKasir({ name: 'Kasir Sore' });
});

const ALASAN = 'Pelanggan memutuskan servis di lain hari.';

describe('POST /api/work-orders/{number}/cancel: berhasil', () => {
  it.each<StatusSpk>(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS'])(
    'dari %s: CANCELLED, alasan dipangkas, satu baris linimasa berisi alasan; item tetap tercatat',
    async (dari) => {
      const awal = await spkDiStatus(b, dari);
      const log = await jumlahLog(awal.number);

      const res = await kirimBatal(b.kasir.token, awal.number, { reason: `  ${ALASAN}\n` });

      harapStatus(res, 200);
      expect(res.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: ALASAN, items: awal.items, total: awal.total });
      expect(res.body.data.timeline.at(-1)).toMatchObject({ fromStatus: dari, toStatus: 'CANCELLED', by: ringkasStaf(b.kasir), note: ALASAN });
      expect(await jumlahLog(awal.number)).toBe(log + 1);
      expect(await barisSpk(awal.number)).toMatchObject({ status: 'CANCELLED', cancel_reason: ALASAN });
      expect((await barisLogSpk(awal.number)).at(-1)).toMatchObject({ from_status: dari, to_status: 'CANCELLED', staff_id: b.kasir.staff.staffId, note: ALASAN });
      harapSetara(await detailSpk(b.kasir.token, awal.number), res.body.data);
    },
  );

  it('pemilik juga boleh membatalkan; SPK tanpa item boleh dibatalkan', async () => {
    const awal = await spkDiStatus(b, 'QUEUED', { item: false });

    const res = await kirimBatal(b.pemilik.token, awal.number, { reason: 'Salah input.' });

    harapStatus(res, 200);
    expect(res.body.data.timeline.at(-1).by).toEqual(ringkasStaf(b.pemilik));
  });

  it('alasan 3 dan 500 karakter sah (dihitung sesudah dipangkas); field lain di badan diabaikan', async () => {
    const a = await spkDiStatus(b, 'QUEUED');
    const c = await spkDiStatus(b, 'QUEUED');

    const pendek = await kirimBatal(b.kasir.token, a.number, { reason: '  abc  ', status: 'DONE', paidAmount: 1 });
    const panjang = await kirimBatal(b.kasir.token, c.number, { reason: 'é'.repeat(500) });

    harapStatus(pendek, 200);
    expect(pendek.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: 'abc', paidAmount: 0 });
    harapStatus(panjang, 200);
    expect(panjang.body.data.cancelReason).toBe('é'.repeat(500));
  });

  it('pembatalan tidak mengirim WhatsApp', async () => {
    const awal = await spkDiStatus(b, 'IN_PROGRESS');
    const wa = await jumlahWaSpk(awal.number);

    harapStatus(await kirimBatal(b.kasir.token, awal.number, { reason: ALASAN }), 200);

    expect(await jumlahWaSpk(awal.number)).toBe(wa);
  });
});

describe('POST /api/work-orders/{number}/cancel: semua part kembali ke stok', () => {
  it('satu kartu RETURNED per sparepart sebesar jumlah quantity item part-nya (catatan kosong, staf pembatal)', async () => {
    const oli = await buatPart(b.pemilik.token, { initialStock: 20 });
    const kampas = await buatPart(b.pemilik.token, { initialStock: 10 });
    const awal = await spkDiStatus(b, 'IN_PROGRESS');
    await tambahPart(b.kasir.token, awal.number, oli.partId, 2);
    await tambahPart(b.kasir.token, awal.number, kampas.partId, 3);
    await tambahPart(b.kasir.token, awal.number, oli.partId, 1);
    expect([await stokDb(oli.partId), await stokDb(kampas.partId)]).toEqual([17, 7]);

    const res = await kirimBatal(kasirLain.token, awal.number, { reason: ALASAN });

    harapStatus(res, 200);
    expect([await stokDb(oli.partId), await stokDb(kampas.partId)]).toEqual([20, 10]);
    const id = await idSpk(awal.number);
    expect((await kartuSpk(oli.partId, awal.number)).map((k) => [k.type, k.quantity, k.stock_after])).toEqual([
      ['USED', -2, 18],
      ['USED', -1, 17],
      ['RETURNED', 3, 20],
    ]);
    expect((await kartuSpk(kampas.partId, awal.number)).map((k) => [k.type, k.quantity, k.stock_after])).toEqual([
      ['USED', -3, 7],
      ['RETURNED', 3, 10],
    ]);
    for (const p of [oli, kampas]) {
      expect((await kartuSpk(p.partId, awal.number)).at(-1)).toMatchObject({ note: '', work_order_id: id, staff_id: kasirLain.staff.staffId });
    }
    expect(res.body.data.items).toHaveLength(4);
    expect(await sparepartTidakCocokKartu()).toEqual([]);
  });

  it('item part yang sudah dihapus sebelumnya tidak dikembalikan dua kali', async () => {
    const part = await buatPart(b.pemilik.token, { initialStock: 10 });
    const awal = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);
    const d = await tambahPart(b.kasir.token, awal.number, part.partId, 2);
    await hapusItem(b.kasir.token, awal.number, d.items[0].itemId);
    await tambahPart(b.kasir.token, awal.number, part.partId, 1);

    harapStatus(await kirimBatal(b.kasir.token, awal.number, { reason: ALASAN }), 200);

    expect(await stokDb(part.partId)).toBe(10);
    expect((await kartuSpk(part.partId, awal.number)).map((k) => [k.type, k.quantity])).toEqual([
      ['USED', -2],
      ['RETURNED', 2],
      ['USED', -1],
      ['RETURNED', 1],
    ]);
  });

  it('sparepart yang sudah nonaktif tetap menerima stoknya kembali', async () => {
    const part = await buatPart(b.pemilik.token, { initialStock: 5 });
    const awal = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);
    await tambahPart(b.kasir.token, awal.number, part.partId, 5);
    await setAktif('parts', part.partId, false);

    harapStatus(await kirimBatal(b.kasir.token, awal.number, { reason: ALASAN }), 200);

    expect(await stokDb(part.partId)).toBe(5);
    expect((await kartuSpk(part.partId, awal.number)).map((k) => k.type)).toEqual(['USED', 'RETURNED']);
  });

  it('SPK tanpa item part tidak menulis kartu stok', async () => {
    const awal = await spkDiStatus(b, 'QUEUED');
    const stok = await stokDb(b.oli.partId);

    harapStatus(await kirimBatal(b.kasir.token, awal.number, { reason: ALASAN }), 200);

    expect(await stokDb(b.oli.partId)).toBe(stok);
    expect(await kartuSpk(b.oli.partId, awal.number)).toEqual([]);
  });
});

describe('POST /api/work-orders/{number}/cancel: ditolak', () => {
  it.each<[string, Record<string, unknown>, string]>([
    ['tidak dikirim', {}, 'required'],
    ['null', { reason: null }, 'required'],
    ['kosong', { reason: '' }, 'required'],
    ['hanya spasi dan baris baru', { reason: ' \n\t ' }, 'required'],
    ['angka', { reason: 123 }, 'invalid_type'],
    ['2 karakter', { reason: 'ab' }, 'too_short'],
    ['2 karakter sesudah dipangkas', { reason: '  ab  ' }, 'too_short'],
    ['501 karakter', { reason: 'é'.repeat(501) }, 'too_long'],
  ])('alasan %s → 422; status tidak berubah', async (_nama, json, kode) => {
    const awal = await spkDiStatus(b, 'QUEUED');

    harapGalat(await kirimBatal(b.kasir.token, awal.number, json), 422, 'validation_failed', { reason: kode });
    expect(await statusDb(awal.number)).toBe('QUEUED');
  });

  it.each<StatusSpk>(['DONE', 'PICKED_UP', 'CANCELLED'])('dari %s → 409 status_transition_invalid; tidak ada yang berubah', async (dari) => {
    const awal = await spkDiStatus(b, dari);

    harapGalat(await kirimBatal(b.kasir.token, awal.number, { reason: 'Dibatalkan lagi.' }), 409, 'status_transition_invalid');
    harapSetara(await detailSpk(b.kasir.token, awal.number), awal);
  });

  it('sudah ada pembayaran → 409 has_payments; stok tidak kembali', async () => {
    const awal = await spkDiStatus(b, 'IN_PROGRESS');
    await tambahPart(b.kasir.token, awal.number, b.kampas.partId, 1);
    const dibayar = await bayar(b.kasir.token, awal.number, 1);
    const stok = await stokDb(b.kampas.partId);

    harapGalat(await kirimBatal(b.kasir.token, awal.number, { reason: ALASAN }), 409, 'has_payments');

    expect(await stokDb(b.kampas.partId)).toBe(stok);
    harapSetara(await detailSpk(b.kasir.token, awal.number), dibayar);
  });

  it('status_transition_invalid lebih dulu dari has_payments: SPK DONE yang sudah dibayar', async () => {
    const awal = await spkDiStatus(b, 'DONE');
    await bayar(b.kasir.token, awal.number, 1000);

    harapGalat(await kirimBatal(b.kasir.token, awal.number, { reason: ALASAN }), 409, 'status_transition_invalid');
  });

  it('422 lebih dulu dari 409: alasan tidak valid pada SPK DONE → 422', async () => {
    const awal = await spkDiStatus(b, 'DONE');

    harapGalat(await kirimBatal(b.kasir.token, awal.number, { reason: 'x' }), 422, 'validation_failed', { reason: 'too_short' });
  });

  it('SPK batal tidak bisa diubah statusnya lagi', async () => {
    const awal = await spkDiStatus(b, 'CANCELLED');

    harapGalat(await kirimStatus(b.kasir.token, awal.number, { status: 'IN_PROGRESS' }), 409, 'status_transition_invalid');
  });
});

describe('POST /api/work-orders/{number}/cancel: urutan 413 → 400 → 401 → 403 → 404', () => {
  it('413 dan 400 lebih dulu dari 401 dan 404', async () => {
    harapGalat(await api.post('/api/work-orders/S-999999/cancel', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    for (const mentah of [JSON_RUSAK, '[]', 'null', '']) {
      harapGalat(await api.post('/api/work-orders/S-999999/cancel', { mentah }), 400, 'bad_request');
    }
  });

  it('401 lebih dulu dari 403 dan 404', async () => {
    harapGalat(await kirimBatal('', 'S-999999', {}), 401, 'unauthenticated');
    harapGalat(await kirimBatal(tokenAcak(), 'S-999999', { reason: ALASAN }), 401, 'unauthenticated');
  });

  it('mekanik → 403, juga untuk SPK miliknya, nomor yang tidak ada, dan badan tidak valid', async () => {
    const milik = await spkDiStatus(b, 'IN_PROGRESS', { mekanik: b.mekanik });

    harapGalat(await kirimBatal(b.mekanik.token, milik.number, { reason: ALASAN }), 403, 'forbidden');
    harapGalat(await kirimBatal(b.mekanik.token, 'S-999999', {}), 403, 'forbidden');
    expect(await statusDb(milik.number)).toBe('IN_PROGRESS');
  });

  it('nomor tidak ada atau bentuk lain → 404, lebih dulu dari 422', async () => {
    const awal = await spkDiStatus(b, 'QUEUED');

    for (const n of ['S-999999', awal.number.toLowerCase(), 'S-5']) {
      harapGalat(await kirimBatal(b.kasir.token, n, {}), 404, 'not_found');
    }
  });
});

describe('POST /api/work-orders/{number}/cancel: permintaan serentak', () => {
  it('pembatalan dan perpindahan status serentak → tepat satu pemenang, keadaan akhir konsisten', async () => {
    const awal = await spkDiStatus(b, 'QUEUED');

    const [status, batal] = await Promise.all([
      kirimStatus(b.kasir.token, awal.number, { status: 'IN_PROGRESS' }),
      kirimBatal(kasirLain.token, awal.number, { reason: ALASAN }),
    ]);

    // Pembatalan sah dari QUEUED maupun IN_PROGRESS, jadi selalu 200. Perpindahan
    // status hanya menang bila diproses lebih dulu; bila tidak, 409.
    harapStatus(batal, 200);
    expect(await statusDb(awal.number)).toBe('CANCELLED');
    if (status.status === 200) {
      expect((await barisLogSpk(awal.number)).map((l) => l.to_status).sort()).toEqual(['CANCELLED', 'IN_PROGRESS', 'QUEUED']);
    } else {
      harapGalat(status, 409, 'status_transition_invalid');
      expect((await barisLogSpk(awal.number)).map((l) => l.to_status).sort()).toEqual(['CANCELLED', 'QUEUED']);
    }
  });
});
