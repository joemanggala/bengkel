// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// POST /api/work-orders (kasir membuat SPK untuk pelanggan yang datang langsung) dan
// GET /api/work-orders/{number} (rincian SPK). Nomor S-0001 berurutan, token lacak
// tersimpan apa adanya (keputusan 0a-1), validasi, dan pesan WhatsApp "SPK dibuat".
// Berkas ini tidak membuat item sparepart, jadi boleh memakai kosongkanSpkDanBooking.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import {
  aturOutlet,
  buatMekanik,
  buatPelangganDenganKendaraan,
  buatSpk,
  detailSpk,
  lacakPublik,
  nomorUnik,
  siapkanBengkel,
  type Bengkel,
} from '../src/data';
import { aturPenghitung, barisLogSpk, barisSpk, barisWaSpk, jumlahBaris, kosongkanSpkDanBooking, nilaiPenghitung, setAktif } from '../src/db';
import { bacaEnv } from '../src/env';
import { nomorSpk, pesanSpkDibuat, tautanLacak } from '../src/format';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { waPalsu } from '../src/wa';
import { JSON_RUSAK, jsonLebihDariSatuMib, tokenAcak } from './pembantu-fondasi';
import { ambilSpk, kirimBuat, kirimUbah, ringkasStaf, uuidAcak } from './pembantu-spk';

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
  await aturOutlet(b.pemilik.token, { name: 'Bengkel Maju Jaya', openingHours: 'Senin–Sabtu 08.00–17.00' });
});

const sah = (ubah: Record<string, unknown> = {}) => ({ vehicleId: b.kendaraan.vehicleId, complaint: 'Servis rutin 2.000 km.', ...ubah });

describe('POST /api/work-orders: SPK baru', () => {
  it('201: SPK QUEUED tanpa item, pelanggan = pemilik kendaraan, total 0 berstatus bayar paid, satu baris linimasa', async () => {
    const res = await kirimBuat(b.kasir.token, sah({ complaint: '  Rem depan bunyi.\nOli bocor sedikit.  ' }));

    harapStatus(res, 201);
    const spk = res.body.data;
    expect(spk).toMatchObject({
      status: 'QUEUED',
      paymentStatus: 'paid',
      customer: { customerId: b.pelanggan.customerId, name: b.pelanggan.name, phone: b.pelanggan.phone },
      vehicle: {
        vehicleId: b.kendaraan.vehicleId,
        type: 'MOTOR',
        plate: b.kendaraan.plate,
        brand: 'Honda',
        model: 'Vario 125',
        year: b.kendaraan.year,
        color: b.kendaraan.color,
      },
      booking: null,
      mechanic: null,
      complaint: 'Rem depan bunyi.\nOli bocor sedikit.',
      diagnosis: '',
      odometer: null,
      estimatedDoneAt: null,
      serviceSubtotal: 0,
      partSubtotal: 0,
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      cancelReason: null,
      createdBy: ringkasStaf(b.kasir),
      items: [],
      payments: [],
    });
    expect(spk.timeline).toEqual([{ fromStatus: null, toStatus: 'QUEUED', by: ringkasStaf(b.kasir), note: '', createdAt: spk.timeline[0].createdAt }]);
    const baris = await barisSpk(spk.number);
    expect(baris).toMatchObject({ status: 'QUEUED', customer_id: b.pelanggan.customerId, created_by_staff_id: b.kasir.staff.staffId, diagnosis: '' });
    expect(await barisLogSpk(spk.number)).toMatchObject([{ from_status: null, to_status: 'QUEUED', staff_id: b.kasir.staff.staffId, note: '' }]);
    harapSetara(await detailSpk(b.kasir.token, spk.number), spk);
  });

  it('pemilik juga boleh membuat SPK; createdBy = pemilik', async () => {
    const res = await kirimBuat(b.pemilik.token, sah());

    harapStatus(res, 201);
    expect(res.body.data.createdBy).toEqual(ringkasStaf(b.pemilik));
    expect(res.body.data.timeline[0].by).toEqual(ringkasStaf(b.pemilik));
  });

  it('field opsional terisi: odometer, estimasi (zona +07:00 disimpan UTC), dan mekanik', async () => {
    const res = await kirimBuat(
      b.kasir.token,
      sah({ odometer: 18250, estimatedDoneAt: '2026-11-28T15:00:00+07:00', mechanicId: b.mekanik.staff.staffId }),
    );

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ odometer: 18250, mechanic: ringkasStaf(b.mekanik) });
    expect(Date.parse(res.body.data.estimatedDoneAt)).toBe(Date.parse('2026-11-28T08:00:00.000Z'));
    expect((await barisSpk(res.body.data.number)).mechanic_staff_id).toBe(b.mekanik.staff.staffId);
  });

  it('null pada odometer, estimatedDoneAt, dan mechanicId sama dengan tidak diisi; batas odometer 0 dan 9.999.999 sah', async () => {
    const kosong = await kirimBuat(b.kasir.token, sah({ odometer: null, estimatedDoneAt: null, mechanicId: null }));
    const nol = await kirimBuat(b.kasir.token, sah({ odometer: 0 }));
    const maks = await kirimBuat(b.kasir.token, sah({ odometer: 9_999_999 }));
    const desimalBulat = await api.post('/api/work-orders', {
      token: b.kasir.token,
      mentah: `{"vehicleId":"${b.kendaraan.vehicleId}","complaint":"Servis.","odometer":1.5e4}`,
    });

    harapStatus(kosong, 201);
    expect(kosong.body.data).toMatchObject({ odometer: null, estimatedDoneAt: null, mechanic: null });
    expect(nol.body.data.odometer).toBe(0);
    expect(maks.body.data.odometer).toBe(9_999_999);
    harapStatus(desimalBulat, 201);
    expect(desimalBulat.body.data.odometer).toBe(15000);
  });

  it('estimasi boleh di masa lalu; batas 2000-01-01 dan 2999-12-31 sah', async () => {
    for (const waktu of ['2000-01-01T00:00:00.000Z', '2999-12-31T23:59:59.999Z', '2001-05-05T10:00:00Z']) {
      const res = await kirimBuat(b.kasir.token, sah({ estimatedDoneAt: waktu }));
      harapStatus(res, 201);
      expect(Date.parse(res.body.data.estimatedDoneAt)).toBe(Date.parse(waktu));
    }
  });

  it('keluhan 1.000 code point sah (emoji dihitung satu); field lain di badan diabaikan', async () => {
    const pelangganLain = await buatPelangganDenganKendaraan(b.kasir.token);
    const res = await kirimBuat(
      b.kasir.token,
      sah({
        complaint: '😀'.repeat(1000),
        customerId: pelangganLain.pelanggan.customerId,
        status: 'DONE',
        number: 'S-9999',
        total: 5,
        paidAmount: 5,
        diagnosis: 'diisi kasir',
        trackingToken: tokenAcak(),
      }),
    );

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ status: 'QUEUED', total: 0, paidAmount: 0, diagnosis: '', customer: { customerId: b.pelanggan.customerId } });
    expect(res.body.data.complaint).toBe('😀'.repeat(1000));
    expect(res.body.data.number).not.toBe('S-9999');
  });

  it('rincian memuat data kendaraan saat ini, bukan salinan saat SPK dibuat', async () => {
    const { kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token);
    const spk = await buatSpk(b.kasir.token, kendaraan.vehicleId);
    harapStatus(await api.patch(`/api/vehicles/${kendaraan.vehicleId}`, { token: b.kasir.token, json: { color: 'Merah', year: 2022 } }), 200);

    expect((await detailSpk(b.kasir.token, spk.number)).vehicle).toMatchObject({ color: 'Merah', year: 2022 });
  });
});

describe('POST /api/work-orders: nomor S-0001 berurutan', () => {
  it('nomor pertama S-0001, lalu S-0002 dan S-0003 walau dibuat staf berbeda; penghitung ikut naik', async () => {
    await kosongkanSpkDanBooking();

    const nomor = [
      (await buatSpk(b.kasir.token, b.kendaraan.vehicleId)).number,
      (await buatSpk(b.pemilik.token, b.kendaraan.vehicleId)).number,
      (await buatSpk(b.kasir.token, b.kendaraan.vehicleId)).number,
    ];

    expect(nomor).toEqual(['S-0001', 'S-0002', 'S-0003']);
    expect(await nilaiPenghitung('work_order_number')).toBe(3);
  });

  it('S-9999 diikuti S-10000 (minimal 4 digit, tidak dipotong)', async () => {
    await kosongkanSpkDanBooking();
    await aturPenghitung('work_order_number', 9998);

    const a = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);
    const c = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);

    expect([a.number, c.number]).toEqual(['S-9999', 'S-10000']);
  });

  it('permintaan yang ditolak (422, 403) tidak memakai nomor: nomor berikutnya tetap tanpa celah', async () => {
    const awal = await nilaiPenghitung('work_order_number');
    const jumlahAwal = await jumlahBaris('work_orders');

    harapStatus(await kirimBuat(b.kasir.token, sah({ complaint: '' })), 422);
    harapStatus(await kirimBuat(b.kasir.token, sah({ vehicleId: uuidAcak() })), 422);
    harapStatus(await kirimBuat(b.mekanik.token, sah()), 403);

    expect(await nilaiPenghitung('work_order_number')).toBe(awal);
    expect(await jumlahBaris('work_orders')).toBe(jumlahAwal);
    expect((await buatSpk(b.kasir.token, b.kendaraan.vehicleId)).number).toBe(nomorSpk(awal + 1));
  });
});

describe('POST /api/work-orders: token lacak (keputusan 0a-1)', () => {
  it('trackingToken 43 karakter base64url ada di balasan dan rincian staf, dan disimpan apa adanya (bukan hash)', async () => {
    const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId, { mechanicId: b.mekanik.staff.staffId });

    expect(spk.trackingToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await barisSpk(spk.number)).tracking_token).toBe(spk.trackingToken);
    for (const sesi of [b.kasir, b.pemilik, b.mekanik]) {
      expect((await detailSpk(sesi.token, spk.number)).trackingToken, sesi.staff.role).toBe(spk.trackingToken);
    }
    expect((await lacakPublik(spk.trackingToken)).number).toBe(spk.number);
  });

  it('setiap SPK mendapat token yang berbeda', async () => {
    const token = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      token.add((await buatSpk(b.kasir.token, b.kendaraan.vehicleId)).trackingToken);
    }
    expect(token.size).toBe(5);
  });
});

describe('POST /api/work-orders: validasi (semua field dilaporkan sekaligus)', () => {
  it.each<[string, Record<string, unknown>, Record<string, string>]>([
    ['vehicleId tidak dikirim', { vehicleId: undefined }, { vehicleId: 'required' }],
    ['vehicleId null', { vehicleId: null }, { vehicleId: 'required' }],
    ['vehicleId kosong', { vehicleId: '' }, { vehicleId: 'required' }],
    ['vehicleId angka', { vehicleId: 12 }, { vehicleId: 'invalid_type' }],
    ['vehicleId bukan UUID', { vehicleId: 'kendaraan-1' }, { vehicleId: 'invalid_format' }],
    ['vehicleId huruf besar', { vehicleId: 'UPPER' }, { vehicleId: 'invalid_format' }],
    ['vehicleId tidak ada', { vehicleId: 'ACAK' }, { vehicleId: 'unknown_reference' }],
    ['complaint tidak dikirim', { complaint: undefined }, { complaint: 'required' }],
    ['complaint null', { complaint: null }, { complaint: 'required' }],
    ['complaint hanya spasi dan baris baru', { complaint: ' \n\t ' }, { complaint: 'required' }],
    ['complaint angka', { complaint: 5 }, { complaint: 'invalid_type' }],
    ['complaint 1.001 karakter', { complaint: 'é'.repeat(1001) }, { complaint: 'too_long' }],
    ['odometer negatif', { odometer: -1 }, { odometer: 'out_of_range' }],
    ['odometer 10.000.000', { odometer: 10_000_000 }, { odometer: 'out_of_range' }],
    ['odometer pecahan', { odometer: 1.5 }, { odometer: 'invalid_type' }],
    ['odometer teks', { odometer: '100' }, { odometer: 'invalid_type' }],
    ['estimatedDoneAt angka', { estimatedDoneAt: 5 }, { estimatedDoneAt: 'invalid_type' }],
    ['estimatedDoneAt tanpa zona', { estimatedDoneAt: '2026-11-28T15:00:00' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt tanpa detik', { estimatedDoneAt: '2026-11-28T15:00Z' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt huruf t kecil', { estimatedDoneAt: '2026-11-28t15:00:00Z' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt tanggal tidak ada', { estimatedDoneAt: '2026-02-30T10:00:00Z' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt jam 24', { estimatedDoneAt: '2026-11-28T24:00:00Z' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt zona +14:30', { estimatedDoneAt: '2026-11-28T10:00:00+14:30' }, { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt sebelum 2000', { estimatedDoneAt: '1999-12-31T23:59:59.999Z' }, { estimatedDoneAt: 'out_of_range' }],
    ['estimatedDoneAt sesudah 2999 (UTC)', { estimatedDoneAt: '2999-12-31T23:00:00-01:00' }, { estimatedDoneAt: 'out_of_range' }],
    ['mechanicId kosong', { mechanicId: '' }, { mechanicId: 'required' }],
    ['mechanicId angka', { mechanicId: 7 }, { mechanicId: 'invalid_type' }],
    ['mechanicId bukan UUID', { mechanicId: 'andi' }, { mechanicId: 'invalid_format' }],
    ['mechanicId tidak ada', { mechanicId: 'ACAK' }, { mechanicId: 'unknown_reference' }],
  ])('%s → 422', async (_nama, ubah, fields) => {
    const isi: Record<string, unknown> = sah();
    for (const [k, v] of Object.entries(ubah)) {
      if (v === undefined) delete isi[k];
      else if (v === 'ACAK') isi[k] = uuidAcak();
      else if (v === 'UPPER') isi[k] = b.kendaraan.vehicleId.toUpperCase();
      else isi[k] = v;
    }

    harapGalat(await kirimBuat(b.kasir.token, isi), 422, 'validation_failed', fields);
  });

  it('mechanicId milik kasir atau pemilik (bukan ber-role mechanic) → unknown_reference', async () => {
    for (const sesi of [b.kasir, b.pemilik]) {
      harapGalat(await kirimBuat(b.kasir.token, sah({ mechanicId: sesi.staff.staffId })), 422, 'validation_failed', {
        mechanicId: 'unknown_reference',
      });
    }
  });

  it('mekanik nonaktif → inactive_reference', async () => {
    const lama = await buatMekanik({ name: 'Mekanik Lama' });
    await setAktif('staff', lama.staff.staffId, false);

    harapGalat(await kirimBuat(b.kasir.token, sah({ mechanicId: lama.staff.staffId })), 422, 'validation_failed', {
      mechanicId: 'inactive_reference',
    });
  });

  it('semua field salah sekaligus, termasuk rujukan → semua dilaporkan; tidak ada yang tersimpan', async () => {
    const jumlahAwal = await jumlahBaris('work_orders');

    harapGalat(
      await kirimBuat(b.kasir.token, { vehicleId: uuidAcak(), complaint: '   ', odometer: -5, estimatedDoneAt: 'besok', mechanicId: uuidAcak() }),
      422,
      'validation_failed',
      { vehicleId: 'unknown_reference', complaint: 'required', odometer: 'out_of_range', estimatedDoneAt: 'invalid_format', mechanicId: 'unknown_reference' },
    );
    expect(await jumlahBaris('work_orders')).toBe(jumlahAwal);
  });
});

describe('POST /api/work-orders: urutan pemeriksaan 413 → 400 → 401 → 403 → 422', () => {
  it('badan lebih dari 1 MiB → 413, lebih dulu dari 400 dan 401', async () => {
    harapGalat(await api.post('/api/work-orders', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
  });

  it('badan rusak atau bukan objek → 400, lebih dulu dari 401', async () => {
    for (const mentah of [JSON_RUSAK, '[]', 'null', '"teks"', '']) {
      harapGalat(await api.post('/api/work-orders', { mentah }), 400, 'bad_request');
    }
  });

  it('tanpa token atau token tidak dikenal → 401, lebih dulu dari 422', async () => {
    harapGalat(await kirimBuat('', {}), 401, 'unauthenticated');
    harapGalat(await kirimBuat(tokenAcak(), sah()), 401, 'unauthenticated');
  });

  it('mekanik → 403, juga dengan badan yang tidak valid (403 lebih dulu dari 422)', async () => {
    harapGalat(await kirimBuat(b.mekanik.token, sah()), 403, 'forbidden');
    harapGalat(await kirimBuat(b.mekanik.token, {}), 403, 'forbidden');
  });
});

describe('POST /api/work-orders: WhatsApp "SPK dibuat" sesudah commit', () => {
  it('pesan work_order_created dikirim ke nomor pelanggan, isinya sama huruf demi huruf dengan templat, dan dicatat sent', async () => {
    const { pelanggan, kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token, { name: 'Ani Lestari' });

    const res = await kirimBuat(b.kasir.token, { vehicleId: kendaraan.vehicleId, complaint: 'Ganti oli.', estimatedDoneAt: '2026-11-28T08:00:00.000Z' });

    harapStatus(res, 201);
    const spk = res.body.data;
    const outlet = (await api.get('/api/outlet')).body.data;
    const harapan = pesanSpkDibuat(outlet, spk, tautanLacak(bacaEnv().publicWebUrl, spk.trackingToken));
    expect(harapan).toContain('Estimasi selesai: 28-11-2026 15:00 WIB');
    const pesan = await waPalsu.untuk(pelanggan.phone);
    expect(pesan.map((p) => p.pesan)).toEqual([harapan]);
    const baris = await barisWaSpk(spk.number, 'work_order_created');
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ phone: pelanggan.phone, body: harapan, status: 'sent', failure_reason: null });
    expect(spk.wa).toMatchObject({ workOrderCreated: { status: 'sent' }, workOrderDone: null, receipt: null });
  });

  it('tanpa estimasi, baris "Estimasi selesai" dihilangkan', async () => {
    const { pelanggan, kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token);

    const spk = await buatSpk(b.kasir.token, kendaraan.vehicleId);

    const outlet = (await api.get('/api/outlet')).body.data;
    const pesan = await waPalsu.terakhir(pelanggan.phone);
    expect(pesan.pesan).toBe(pesanSpkDibuat(outlet, spk, tautanLacak(bacaEnv().publicWebUrl, spk.trackingToken)));
    expect(pesan.pesan).not.toContain('Estimasi');
  });

  it('gagal kirim tidak menggagalkan permintaan: 201, SPK tersimpan, wa.workOrderCreated failed', async () => {
    const nomor = nomorUnik();
    const { kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token, { phone: nomor });
    await waPalsu.gangguan({ gagal: true, nomor });
    try {
      const res = await kirimBuat(b.kasir.token, { vehicleId: kendaraan.vehicleId, complaint: 'Servis.' });

      harapStatus(res, 201);
      expect(res.body.data.wa.workOrderCreated.status).toBe('failed');
      const baris = await barisWaSpk(res.body.data.number, 'work_order_created');
      expect(baris).toHaveLength(1);
      expect(baris[0]?.status).toBe('failed');
      expect(baris[0]?.failure_reason).toBeTruthy();
      expect((await detailSpk(b.kasir.token, res.body.data.number)).wa.workOrderCreated.status).toBe('failed');
    } finally {
      await waPalsu.gangguan({ gagal: false, nomor });
    }
  });
});

describe('GET /api/work-orders/{number}: urutan 401 → 404 → 403', () => {
  it('tanpa token → 401, juga untuk nomor yang tidak ada', async () => {
    const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);

    harapGalat(await ambilSpk('', spk.number), 401, 'unauthenticated');
    harapGalat(await ambilSpk('', 'S-999999'), 401, 'unauthenticated');
  });

  it('nomor tidak ada atau bentuk lain (huruf kecil, kurang dari 4 digit, LF di akhir) → 404', async () => {
    const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);

    for (const nomor of ['S-999999', spk.number.toLowerCase(), 'S-1', `${spk.number}%0A`, spk.number.replace('S-', 'B-')]) {
      harapGalat(await ambilSpk(b.kasir.token, nomor), 404, 'not_found');
    }
  });

  it('mekanik: SPK miliknya 200; milik mekanik lain atau tanpa mekanik → 403; nomor tidak ada → 404 (404 lebih dulu)', async () => {
    const lain = await buatMekanik({ name: 'Mekanik Lain' });
    const milik = await buatSpk(b.kasir.token, b.kendaraan.vehicleId, { mechanicId: b.mekanik.staff.staffId });
    const punyaLain = await buatSpk(b.kasir.token, b.kendaraan.vehicleId, { mechanicId: lain.staff.staffId });
    const tanpa = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);

    harapSetara(await detailSpk(b.mekanik.token, milik.number), await detailSpk(b.kasir.token, milik.number));
    harapGalat(await ambilSpk(b.mekanik.token, punyaLain.number), 403, 'forbidden');
    harapGalat(await ambilSpk(b.mekanik.token, tanpa.number), 403, 'forbidden');
    harapGalat(await ambilSpk(b.mekanik.token, 'S-999999'), 404, 'not_found');
  });

  it('SPK yang dipindah ke mekanik lain langsung tertutup bagi mekanik lama', async () => {
    const lain = await buatMekanik({ name: 'Mekanik Pengganti' });
    const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId, { mechanicId: b.mekanik.staff.staffId });
    harapStatus(await kirimUbah(b.kasir.token, spk.number, { mechanicId: lain.staff.staffId }), 200);

    harapGalat(await ambilSpk(b.mekanik.token, spk.number), 403, 'forbidden');
    harapStatus(await ambilSpk(lain.token, spk.number), 200);
  });
});
