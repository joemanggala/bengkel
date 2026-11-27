// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// PATCH /api/work-orders/{number}: pemilik dan kasir mengubah mekanik, keluhan,
// odometer, estimasi, dan diagnosis; mekanik hanya diagnosis dan hanya SPK miliknya;
// SPK terkunci sejak DONE (keputusan 0a-5). Urutan: 413 → 400 → 401 → 404 → 403
// (kepemilikan, kunci terlarang) → 422 → 409 work_order_locked → 200.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import { buatMekanik, buatSpk, detailSpk, siapkanBengkel, type Bengkel } from '../src/data';
import { barisSpk, setAktif } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { JSON_RUSAK, jsonLebihDariSatuMib, tokenAcak } from './pembantu-fondasi';
import {
  jumlahLog,
  jumlahWaSpk,
  kirimUbah,
  mundurkanUpdatedAt,
  ringkasStaf,
  sesudahWaktuLama,
  spkDiStatus,
  uuidAcak,
  type StatusSpk,
} from './pembantu-spk';

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
});

const spk = (ubah: Record<string, unknown> = {}) => buatSpk(b.kasir.token, b.kendaraan.vehicleId, ubah);
const spkMekanik = () => spk({ mechanicId: b.mekanik.staff.staffId });

describe('PATCH /api/work-orders/{number}: pemilik dan kasir', () => {
  it('mengubah kelima field sekaligus; balasan = rincian sesudah diubah; updatedAt diperbarui', async () => {
    const awal = await spk({ odometer: 100 });
    await mundurkanUpdatedAt(awal.number);

    const res = await kirimUbah(b.kasir.token, awal.number, {
      mechanicId: b.mekanik.staff.staffId,
      complaint: '  Rem blong.\nLampu mati.  ',
      diagnosis: '  Kampas rem habis.\nBohlam putus.  ',
      odometer: 18250,
      estimatedDoneAt: '2026-11-28T15:00:00.5+07:00',
    });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({
      mechanic: ringkasStaf(b.mekanik),
      complaint: 'Rem blong.\nLampu mati.',
      diagnosis: 'Kampas rem habis.\nBohlam putus.',
      odometer: 18250,
      status: 'QUEUED',
    });
    expect(Date.parse(res.body.data.estimatedDoneAt)).toBe(Date.parse('2026-11-28T08:00:00.500Z'));
    expect(sesudahWaktuLama(res.body.data.updatedAt)).toBe(true);
    harapSetara(await detailSpk(b.kasir.token, awal.number), res.body.data);
  });

  it('perubahan sebagian: field yang tidak dikirim tidak berubah', async () => {
    const awal = await spk({ odometer: 500, estimatedDoneAt: '2026-12-01T03:00:00.000Z', mechanicId: b.mekanik.staff.staffId, complaint: 'Mesin brebet.' });

    const res = await kirimUbah(b.pemilik.token, awal.number, { odometer: 600 });

    harapStatus(res, 200);
    harapSetara({ ...res.body.data, odometer: 500, updatedAt: awal.updatedAt }, awal);
  });

  it('{} → 200 tanpa perubahan', async () => {
    const awal = await spkMekanik();

    const res = await kirimUbah(b.kasir.token, awal.number, {});

    harapStatus(res, 200);
    harapSetara({ ...res.body.data, updatedAt: awal.updatedAt }, awal);
  });

  it('null pada mechanicId, odometer, dan estimatedDoneAt mengosongkannya', async () => {
    const awal = await spk({ odometer: 500, estimatedDoneAt: '2026-12-01T03:00:00.000Z', mechanicId: b.mekanik.staff.staffId });

    const res = await kirimUbah(b.kasir.token, awal.number, { mechanicId: null, odometer: null, estimatedDoneAt: null });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ mechanic: null, odometer: null, estimatedDoneAt: null });
    expect((await barisSpk(awal.number)).mechanic_staff_id).toBeNull();
  });

  it('diagnosis boleh dikosongkan; estimasi masa lalu boleh', async () => {
    const awal = await spk();
    harapStatus(await kirimUbah(b.kasir.token, awal.number, { diagnosis: 'Sementara.' }), 200);

    const res = await kirimUbah(b.kasir.token, awal.number, { diagnosis: ' \n ', estimatedDoneAt: '2001-01-01T00:00:00Z' });

    harapStatus(res, 200);
    expect(res.body.data.diagnosis).toBe('');
    expect(Date.parse(res.body.data.estimatedDoneAt)).toBe(Date.parse('2001-01-01T00:00:00Z'));
  });

  it('mengganti dan melepas mekanik tidak menulis linimasa dan tidak mengirim WhatsApp', async () => {
    const lain = await buatMekanik({ name: 'Mekanik Kedua' });
    const awal = await spkMekanik();
    const log = await jumlahLog(awal.number);
    const wa = await jumlahWaSpk(awal.number);

    harapStatus(await kirimUbah(b.kasir.token, awal.number, { mechanicId: lain.staff.staffId }), 200);
    harapStatus(await kirimUbah(b.kasir.token, awal.number, { mechanicId: null, complaint: 'Baru.', diagnosis: 'x' }), 200);

    expect(await jumlahLog(awal.number)).toBe(log);
    expect(await jumlahWaSpk(awal.number)).toBe(wa);
  });

  it('field lain di badan diabaikan (status, total, nomor, pelanggan)', async () => {
    const awal = await spk();

    const res = await kirimUbah(b.kasir.token, awal.number, { status: 'DONE', total: 99, number: 'S-0001', paidAmount: 5, customerId: uuidAcak() });

    harapStatus(res, 200);
    harapSetara({ ...res.body.data, updatedAt: awal.updatedAt }, awal);
  });

  it('dua PATCH serentak yang mengubah field berbeda (kasir dan mekanik) sama-sama bertahan', async () => {
    const awal = await spkMekanik();

    const semua = await Promise.all([
      kirimUbah(b.kasir.token, awal.number, { odometer: 321, complaint: 'Diperbarui kasir.' }),
      kirimUbah(b.mekanik.token, awal.number, { diagnosis: 'Diperbarui mekanik.' }),
      kirimUbah(b.pemilik.token, awal.number, { estimatedDoneAt: '2026-12-01T01:00:00.000Z' }),
    ]);

    expect(semua.map((r) => r.status)).toEqual([200, 200, 200]);
    const akhir = await detailSpk(b.kasir.token, awal.number);
    expect(akhir).toMatchObject({ odometer: 321, complaint: 'Diperbarui kasir.', diagnosis: 'Diperbarui mekanik.', mechanic: ringkasStaf(b.mekanik) });
    expect(Date.parse(akhir.estimatedDoneAt)).toBe(Date.parse('2026-12-01T01:00:00.000Z'));
  });

  it.each<StatusSpk>(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS'])('boleh diubah selama %s', async (status) => {
    const awal = await spkDiStatus(b, status);

    const res = await kirimUbah(b.kasir.token, awal.number, { odometer: 42 });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ status, odometer: 42 });
  });
});

describe('PATCH /api/work-orders/{number}: mechanicId', () => {
  it('staf yang bukan mekanik (kasir, pemilik) atau UUID tak dikenal → unknown_reference', async () => {
    const awal = await spk();
    for (const id of [b.kasir.staff.staffId, b.pemilik.staff.staffId, uuidAcak()]) {
      harapGalat(await kirimUbah(b.kasir.token, awal.number, { mechanicId: id }), 422, 'validation_failed', { mechanicId: 'unknown_reference' });
    }
  });

  it('menugaskan mekanik nonaktif → inactive_reference', async () => {
    const lama = await buatMekanik({ name: 'Mekanik Cuti' });
    await setAktif('staff', lama.staff.staffId, false);
    const awal = await spk();

    harapGalat(await kirimUbah(b.kasir.token, awal.number, { mechanicId: lama.staff.staffId }), 422, 'validation_failed', {
      mechanicId: 'inactive_reference',
    });
  });

  it('mengirim ID mekanik yang sama dengan yang sekarang tidak diperiksa lagi, walau mekanik itu sudah nonaktif', async () => {
    const lama = await buatMekanik({ name: 'Mekanik Lama' });
    const awal = await spk({ mechanicId: lama.staff.staffId });
    await setAktif('staff', lama.staff.staffId, false);

    const res = await kirimUbah(b.kasir.token, awal.number, { mechanicId: lama.staff.staffId, odometer: 7 });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ mechanic: ringkasStaf(lama), odometer: 7 });
  });
});

describe('PATCH /api/work-orders/{number}: validasi', () => {
  it.each<[string, Record<string, unknown>, Record<string, string>]>([
    ['complaint null', { complaint: null }, { complaint: 'required' }],
    ['complaint kosong', { complaint: '  \n ' }, { complaint: 'required' }],
    ['complaint angka', { complaint: 1 }, { complaint: 'invalid_type' }],
    ['complaint 1.001 karakter', { complaint: 'a'.repeat(1001) }, { complaint: 'too_long' }],
    ['diagnosis null', { diagnosis: null }, { diagnosis: 'invalid_type' }],
    ['diagnosis angka', { diagnosis: 3 }, { diagnosis: 'invalid_type' }],
    ['diagnosis 2.001 karakter', { diagnosis: 'é'.repeat(2001) }, { diagnosis: 'too_long' }],
    ['odometer negatif', { odometer: -1 }, { odometer: 'out_of_range' }],
    ['odometer 10.000.000', { odometer: 10_000_000 }, { odometer: 'out_of_range' }],
    ['odometer pecahan', { odometer: 0.5 }, { odometer: 'invalid_type' }],
    ['odometer teks', { odometer: '7' }, { odometer: 'invalid_type' }],
    ['odometer boolean', { odometer: true }, { odometer: 'invalid_type' }],
    ['estimatedDoneAt bukan waktu', { estimatedDoneAt: 'besok' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt Z huruf kecil', { estimatedDoneAt: '2026-11-28T08:00:00z' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt menit 60', { estimatedDoneAt: '2026-11-28T08:60:00Z' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt 4 digit pecahan', { estimatedDoneAt: '2026-11-28T08:00:00.1234Z' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt sebelum 2000 (UTC)', { estimatedDoneAt: '2000-01-01T06:59:59+07:00' }, { estimatedDoneAt: 'out_of_range' }],
    ['estimatedDoneAt larik', { estimatedDoneAt: [] }, { estimatedDoneAt: 'invalid_type' }],
    ['estimatedDoneAt string kosong (bukan pengosong; pakai null)', { estimatedDoneAt: '' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt tahun 0000', { estimatedDoneAt: '0000-06-15T12:00:00+07:00' }, { estimatedDoneAt: 'out_of_range' }],
    ['mechanicId kosong', { mechanicId: '' }, { mechanicId: 'required' }],
    ['mechanicId angka', { mechanicId: 1 }, { mechanicId: 'invalid_type' }],
    ['mechanicId bukan UUID', { mechanicId: 'andi' }, { mechanicId: 'invalid_format' }],
  ])('%s → 422; tidak ada yang berubah', async (_nama, json, fields) => {
    const awal = await spk();

    harapGalat(await kirimUbah(b.kasir.token, awal.number, json), 422, 'validation_failed', fields);
    harapSetara(await detailSpk(b.kasir.token, awal.number), awal);
  });

  it('batas sah: keluhan 1.000 dan diagnosis 2.000 karakter, odometer 0 dan 9.999.999', async () => {
    const awal = await spk();

    const a = await kirimUbah(b.kasir.token, awal.number, { complaint: 'k'.repeat(1000), diagnosis: 'd'.repeat(2000), odometer: 0 });
    const c = await kirimUbah(b.kasir.token, awal.number, { odometer: 9_999_999 });

    harapStatus(a, 200);
    expect(a.body.data.odometer).toBe(0);
    expect(c.body.data.odometer).toBe(9_999_999);
  });

  it('semua field yang salah dilaporkan sekaligus, termasuk rujukan', async () => {
    const awal = await spk();

    harapGalat(
      await kirimUbah(b.kasir.token, awal.number, { mechanicId: uuidAcak(), complaint: null, diagnosis: null, odometer: -3, estimatedDoneAt: 'x' }),
      422,
      'validation_failed',
      { mechanicId: 'unknown_reference', complaint: 'required', diagnosis: 'invalid_type', odometer: 'out_of_range', estimatedDoneAt: 'invalid_format' },
    );
  });
});

describe('PATCH /api/work-orders/{number}: mekanik hanya diagnosis dan hanya SPK miliknya', () => {
  it('mekanik mengisi diagnosis SPK miliknya → 200', async () => {
    const awal = await spkMekanik();

    const res = await kirimUbah(b.mekanik.token, awal.number, { diagnosis: '  Busi kotor.  ' });

    harapStatus(res, 200);
    expect(res.body.data.diagnosis).toBe('Busi kotor.');
    expect((await barisSpk(awal.number)).diagnosis).toBe('Busi kotor.');
  });

  it('mekanik mengirim {} untuk SPK miliknya → 200 tanpa perubahan', async () => {
    const awal = await spkMekanik();

    const res = await kirimUbah(b.mekanik.token, awal.number, {});

    harapStatus(res, 200);
    harapSetara({ ...res.body.data, updatedAt: awal.updatedAt }, awal);
  });

  it.each<[string, Record<string, unknown>]>([
    ['mechanicId', { mechanicId: null }],
    ['complaint', { complaint: 'Diganti mekanik.' }],
    ['odometer', { odometer: null }],
    ['estimatedDoneAt', { estimatedDoneAt: '2026-11-28T08:00:00Z' }],
    ['diagnosis bersama complaint', { diagnosis: 'Boleh.', complaint: 'Tidak boleh.' }],
  ])('mekanik mengirim kunci %s (apa pun nilainya, termasuk null) → 403; tidak ada yang berubah', async (_nama, json) => {
    const awal = await spkMekanik();

    harapGalat(await kirimUbah(b.mekanik.token, awal.number, json), 403, 'forbidden');
    harapSetara(await detailSpk(b.kasir.token, awal.number), awal);
  });

  it('mekanik membuka SPK milik mekanik lain atau tanpa mekanik → 403, juga untuk badan yang tidak valid', async () => {
    const lain = await buatMekanik({ name: 'Mekanik Seberang' });
    const punyaLain = await spk({ mechanicId: lain.staff.staffId });
    const tanpa = await spk();

    for (const n of [punyaLain.number, tanpa.number]) {
      harapGalat(await kirimUbah(b.mekanik.token, n, { diagnosis: 'Diam-diam.' }), 403, 'forbidden');
      harapGalat(await kirimUbah(b.mekanik.token, n, { diagnosis: null }), 403, 'forbidden');
    }
    expect((await barisSpk(punyaLain.number)).diagnosis).toBe('');
  });

  it('403 kunci terlarang lebih dulu dari 422: mekanik mengirim complaint null → 403, bukan 422', async () => {
    const awal = await spkMekanik();

    harapGalat(await kirimUbah(b.mekanik.token, awal.number, { complaint: null, diagnosis: 5 }), 403, 'forbidden');
  });

  it('diagnosis tidak valid dari mekanik pemilik SPK → 422', async () => {
    const awal = await spkMekanik();

    harapGalat(await kirimUbah(b.mekanik.token, awal.number, { diagnosis: null }), 422, 'validation_failed', { diagnosis: 'invalid_type' });
  });

  it('404 lebih dulu dari 403: mekanik dengan nomor yang tidak ada → 404', async () => {
    harapGalat(await kirimUbah(b.mekanik.token, 'S-999999', { complaint: 'x' }), 404, 'not_found');
  });
});

describe('PATCH /api/work-orders/{number}: terkunci sejak DONE → 409 work_order_locked', () => {
  it.each<StatusSpk>(['DONE', 'PICKED_UP', 'CANCELLED'])('%s: kasir mengubah apa pun, termasuk {}, → 409; tidak ada yang berubah', async (status) => {
    const awal = await spkDiStatus(b, status, { mekanik: b.mekanik });

    for (const json of [{}, { odometer: 1 }, { diagnosis: 'Telat.' }, { mechanicId: null }]) {
      harapGalat(await kirimUbah(b.kasir.token, awal.number, json), 409, 'work_order_locked');
    }
    harapSetara(await detailSpk(b.kasir.token, awal.number), awal);
  });

  it('mekanik pemilik SPK DONE: diagnosis → 409; kunci terlarang → 403 (403 lebih dulu dari 409)', async () => {
    const awal = await spkDiStatus(b, 'DONE', { mekanik: b.mekanik });

    harapGalat(await kirimUbah(b.mekanik.token, awal.number, { diagnosis: 'Telat.' }), 409, 'work_order_locked');
    harapGalat(await kirimUbah(b.mekanik.token, awal.number, { complaint: 'x' }), 403, 'forbidden');
  });

  it('422 lebih dulu dari 409: badan tidak valid pada SPK DONE → 422', async () => {
    const awal = await spkDiStatus(b, 'DONE');

    harapGalat(await kirimUbah(b.kasir.token, awal.number, { odometer: -1 }), 422, 'validation_failed', { odometer: 'out_of_range' });
  });
});

describe('PATCH /api/work-orders/{number}: urutan 413 → 400 → 401 → 404', () => {
  it('badan lebih dari 1 MiB → 413; JSON rusak atau bukan objek → 400; keduanya tanpa token dan untuk nomor tak dikenal', async () => {
    harapGalat(await api.patch('/api/work-orders/S-999999', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    for (const mentah of [JSON_RUSAK, '[]', '1', '']) {
      harapGalat(await api.patch('/api/work-orders/S-999999', { mentah }), 400, 'bad_request');
    }
  });

  it('tanpa token atau token tak dikenal → 401, lebih dulu dari 404 dan 422', async () => {
    const awal = await spk();

    harapGalat(await kirimUbah('', 'S-999999', { odometer: -1 }), 401, 'unauthenticated');
    harapGalat(await kirimUbah(tokenAcak(), awal.number, { odometer: 1 }), 401, 'unauthenticated');
  });

  it('nomor tidak ada atau bentuk lain → 404, lebih dulu dari 422', async () => {
    const awal = await spk();

    for (const n of ['S-999999', awal.number.toLowerCase(), 'S-12']) {
      harapGalat(await kirimUbah(b.kasir.token, n, { odometer: -1 }), 404, 'not_found');
    }
  });
});
