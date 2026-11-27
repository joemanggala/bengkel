// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { buatBookingPublik, buatMekanik, buatPelangganDenganKendaraan, siapkanBengkel, type Bengkel, type SesiStaf } from '../src/data';
import { setAktif } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { bookingBerstatus, jejakKonversi, konversi } from './pembantu-booking';
import { JSON_RUSAK, jsonLebihDariSatuMib } from './pembantu-fondasi';

// POST /api/bookings/{bookingId}/convert: urutan pemeriksaan, validasi badan
// (aturan sama dengan BuatSpkRequest), dan perpindahan status yang tidak sah.
// Setiap penolakan dibuktikan tidak mengubah booking, pelanggan, kendaraan,
// SPK, pesan WhatsApp, maupun penghitung nomor SPK.

let b: Bengkel;
let mekanikNonaktif: SesiStaf;

beforeAll(async () => {
  b = await siapkanBengkel();
  mekanikNonaktif = await buatMekanik({ name: 'Mekanik Lama' });
  await setAktif('staff', mekanikNonaktif.staff.staffId, false);
});

describe('perpindahan: hanya dari PENDING dan CONFIRMED', () => {
  it.each(['CONVERTED', 'REJECTED', 'CANCELLED'] as const)('booking %s → 409 booking_transition_invalid tanpa SPK baru', async (status) => {
    const { bookingId, booking } = await bookingBerstatus(b, status);
    const sebelum = await jejakKonversi(booking.number);

    harapGalat(await konversi(b.kasir.token, bookingId), 409, 'booking_transition_invalid');

    expect(await jejakKonversi(booking.number)).toEqual(sebelum);
  });

  it('booking yang sudah dijadikan SPK tidak bisa dijadikan SPK kedua kali', async () => {
    const { bookingId, booking } = await buatBookingPublik();
    harapStatus(await konversi(b.kasir.token, bookingId), 201);
    const sebelum = await jejakKonversi(booking.number);

    harapGalat(await konversi(b.pemilik.token, bookingId), 409, 'booking_transition_invalid');

    expect(await jejakKonversi(booking.number)).toEqual(sebelum);
  });

  it('booking_transition_invalid dinilai sebelum plate_owned_by_other_customer', async () => {
    const { kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token);
    const { bookingId, booking } = await bookingBerstatus(b, 'REJECTED', { plate: kendaraan.plate });
    const sebelum = await jejakKonversi(booking.number);

    harapGalat(await konversi(b.kasir.token, bookingId), 409, 'booking_transition_invalid');

    expect(await jejakKonversi(booking.number)).toEqual(sebelum);
  });
});

describe('urutan 413 → 400 → 401 → 403 → 404 → 422 → 409', () => {
  it('pada booking yang sudah dibatalkan, setiap langkah mengalahkan langkah sesudahnya', async () => {
    const { bookingId, booking } = await bookingBerstatus(b, 'CANCELLED');
    const sebelum = await jejakKonversi(booking.number);
    const salah = { mechanicId: 'bukan-uuid' };

    harapGalat(await konversi(undefined, bookingId, undefined, { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await konversi(undefined, bookingId, undefined, { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await konversi(undefined, bookingId, salah), 401, 'unauthenticated');
    harapGalat(await konversi(b.mekanik.token, bookingId, salah), 403, 'forbidden');
    harapGalat(await konversi(b.mekanik.token, randomUUID(), salah), 403, 'forbidden');
    harapGalat(await konversi(b.kasir.token, randomUUID(), salah), 404, 'not_found');
    harapGalat(await konversi(b.kasir.token, bookingId.toUpperCase(), salah), 404, 'not_found');
    harapGalat(await konversi(b.kasir.token, bookingId, salah), 422, 'validation_failed', { mechanicId: 'invalid_format' });
    harapGalat(await konversi(b.kasir.token, bookingId, {}), 409, 'booking_transition_invalid');

    expect(await jejakKonversi(booking.number)).toEqual(sebelum);
  });

  it.each([
    ['JSON rusak', JSON_RUSAK],
    ['larik', '[]'],
    ['string', '"x"'],
    ['angka', '1'],
    ['null', 'null'],
    ['badan kosong', ''],
  ])('badan wajib objek JSON: %s → 400 bad_request walau booking PENDING', async (_nama, mentah) => {
    const { bookingId, booking } = await buatBookingPublik();
    const sebelum = await jejakKonversi(booking.number);

    harapGalat(await konversi(b.kasir.token, bookingId, undefined, { mentah }), 400, 'bad_request');

    expect(await jejakKonversi(booking.number)).toEqual(sebelum);
  });

  it('422 dinilai sebelum 409 plate_owned_by_other_customer', async () => {
    const { kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token);
    const { bookingId, booking } = await buatBookingPublik({ plate: kendaraan.plate });
    const sebelum = await jejakKonversi(booking.number);

    harapGalat(await konversi(b.kasir.token, bookingId, { odometer: -1 }), 422, 'validation_failed', { odometer: 'out_of_range' });
    harapGalat(await konversi(b.kasir.token, bookingId, {}), 409, 'plate_owned_by_other_customer');

    expect(await jejakKonversi(booking.number)).toEqual(sebelum);
  });
});

describe('validasi badan (aturan BuatSpkRequest) → 422 tanpa mengubah apa pun', () => {
  it.each<[string, () => Record<string, unknown>, Record<string, string>]>([
    ['mechanicId kosong', () => ({ mechanicId: '' }), { mechanicId: 'required' }],
    ['mechanicId angka', () => ({ mechanicId: 5 }), { mechanicId: 'invalid_type' }],
    ['mechanicId bukan UUID', () => ({ mechanicId: 'mekanik-1' }), { mechanicId: 'invalid_format' }],
    ['mechanicId huruf besar', () => ({ mechanicId: b.mekanik.staff.staffId.toUpperCase() }), { mechanicId: 'invalid_format' }],
    ['mechanicId tak dikenal', () => ({ mechanicId: randomUUID() }), { mechanicId: 'unknown_reference' }],
    ['mechanicId kasir', () => ({ mechanicId: b.kasir.staff.staffId }), { mechanicId: 'unknown_reference' }],
    ['mechanicId pemilik', () => ({ mechanicId: b.pemilik.staff.staffId }), { mechanicId: 'unknown_reference' }],
    ['mechanicId mekanik nonaktif', () => ({ mechanicId: mekanikNonaktif.staff.staffId }), { mechanicId: 'inactive_reference' }],
    ['odometer negatif', () => ({ odometer: -1 }), { odometer: 'out_of_range' }],
    ['odometer 10.000.000', () => ({ odometer: 10000000 }), { odometer: 'out_of_range' }],
    ['odometer pecahan', () => ({ odometer: 1.5 }), { odometer: 'invalid_type' }],
    ['odometer string', () => ({ odometer: '100' }), { odometer: 'invalid_type' }],
    ['estimatedDoneAt tanpa zona', () => ({ estimatedDoneAt: '2026-12-01T08:00:00' }), { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt berspasi', () => ({ estimatedDoneAt: '2026-12-01 08:00:00Z' }), { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt 30 Februari', () => ({ estimatedDoneAt: '2026-02-30T08:00:00Z' }), { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt jam 24', () => ({ estimatedDoneAt: '2026-12-01T24:00:00Z' }), { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt zona +15:00', () => ({ estimatedDoneAt: '2026-12-01T08:00:00+15:00' }), { estimatedDoneAt: 'invalid_format' }],
    ['estimatedDoneAt sebelum 2000', () => ({ estimatedDoneAt: '1999-12-31T23:59:59Z' }), { estimatedDoneAt: 'out_of_range' }],
    ['estimatedDoneAt angka', () => ({ estimatedDoneAt: 5 }), { estimatedDoneAt: 'invalid_type' }],
    [
      'semua sekaligus',
      () => ({ mechanicId: randomUUID(), odometer: 1.5, estimatedDoneAt: 'besok' }),
      { mechanicId: 'unknown_reference', odometer: 'invalid_type', estimatedDoneAt: 'invalid_format' },
    ],
  ])('%s', async (_nama, badan, fields) => {
    const { bookingId, booking } = await buatBookingPublik();
    const sebelum = await jejakKonversi(booking.number);

    harapGalat(await konversi(b.kasir.token, bookingId, badan()), 422, 'validation_failed', fields);

    expect(await jejakKonversi(booking.number)).toEqual(sebelum);
  });

  it('odometer di atas 2^53−1 (1e400) → out_of_range', async () => {
    const { bookingId } = await buatBookingPublik();

    harapGalat(await konversi(b.kasir.token, bookingId, undefined, { mentah: '{"odometer":1e400}' }), 422, 'validation_failed', { odometer: 'out_of_range' });
  });

  it('diterima: null pada ketiganya, odometer 0 dan 9.999.999, 1.5e4 sebagai integer, estimasi di masa lalu', async () => {
    const kosong = await konversi(b.kasir.token, (await buatBookingPublik()).bookingId, { mechanicId: null, odometer: null, estimatedDoneAt: null });
    harapStatus(kosong, 201);
    expect(kosong.body.data.workOrder).toMatchObject({ mechanic: null, odometer: null, estimatedDoneAt: null });

    for (const odometer of [0, 9999999]) {
      const res = await konversi(b.kasir.token, (await buatBookingPublik()).bookingId, { odometer });
      harapStatus(res, 201);
      expect(res.body.data.workOrder.odometer).toBe(odometer);
    }

    const eksponen = await konversi(b.kasir.token, (await buatBookingPublik()).bookingId, undefined, { mentah: '{"odometer":1.5e4}' });
    harapStatus(eksponen, 201);
    expect(eksponen.body.data.workOrder.odometer).toBe(15000);

    const lalu = await konversi(b.kasir.token, (await buatBookingPublik()).bookingId, { estimatedDoneAt: '2020-01-01T00:00:00Z' });
    harapStatus(lalu, 201);
    expect(Date.parse(lalu.body.data.workOrder.estimatedDoneAt)).toBe(Date.parse('2020-01-01T00:00:00.000Z'));
  });

  it('field yang tidak dikenal diabaikan; badan {} cukup', async () => {
    const res = await konversi(b.kasir.token, (await buatBookingPublik()).bookingId, { status: 'DONE', items: [{ type: 'PART' }], workOrderNumber: 'S-9999' });

    harapStatus(res, 201);
    expect(res.body.data.workOrder).toMatchObject({ status: 'QUEUED', items: [] });
  });
});
