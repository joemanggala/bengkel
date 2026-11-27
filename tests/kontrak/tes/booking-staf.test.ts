// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { aturOutlet, buatBookingPublik, buatJasa, konfirmasiBooking, nomorUnik, siapkanBengkel, wajib, type Bengkel } from '../src/data';
import { barisBooking, barisWaBooking, jumlahBaris } from '../src/db';
import { bacaEnv } from '../src/env';
import { pesanBookingDikonfirmasi, pesanBookingDitolak, samarkanHp } from '../src/format';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { waPalsu } from '../src/wa';
import {
  ALASAN_TOLAK,
  bookingBerstatus,
  daftarBooking,
  FIELD_BOOKING_STAF,
  konfirmasi,
  konversi,
  lihatBookingPublik,
  rincianBooking,
  tolak,
  type StatusBooking,
} from './pembantu-booking';
import { JSON_RUSAK, jsonLebihDariSatuMib } from './pembantu-fondasi';

// Booking di panel staf: rincian, konfirmasi, tolak, perpindahan yang tidak
// sah, dan peran. Daftar dan filternya di booking-staf-daftar.test.ts,
// konversi menjadi SPK di konversi-booking*.test.ts.

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
  await aturOutlet(b.pemilik.token, { name: 'Bengkel Maju Jaya', address: 'Jl. Merdeka No. 10, Bandung', openingHours: 'Senin–Sabtu 08.00–17.00' });
});

async function outletSekarang(): Promise<any> {
  return wajib(await api.get('/api/outlet'), 200).body.data;
}

// Keadaan booking yang tidak boleh berubah oleh permintaan yang ditolak.
async function jejak(nomor: string, phone: string): Promise<unknown> {
  const baris = await barisBooking(nomor);
  return {
    status: baris.status,
    staf: baris.handled_by_staff_id,
    alasan: baris.reject_reason,
    spk: baris.work_order_id,
    waDb: (await barisWaBooking(nomor)).length,
    waPalsu: (await waPalsu.untuk(phone)).length,
  };
}

describe('GET /api/bookings/{bookingId}', () => {
  it('200 Booking untuk staf: nomor HP utuh, kunci plat, jasa, wa kosong, handledBy null; pemilik dan kasir sama', async () => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({ phone: seragam, plate: 'b 1234-xyz', serviceId: b.gantiOli.serviceId });

    const res = await rincianBooking(b.kasir.token, bookingId);

    harapStatus(res, 200);
    expect(Object.keys(res.body.data).sort()).toEqual([...FIELD_BOOKING_STAF].sort());
    expect(res.body.data).toEqual({
      bookingId,
      number: booking.number,
      status: 'PENDING',
      customerName: booking.customerName,
      phone: seragam,
      vehicleType: booking.vehicleType,
      plate: 'B 1234 XYZ',
      plateKey: 'B1234XYZ',
      vehicleBrand: booking.vehicleBrand,
      vehicleModel: booking.vehicleModel,
      service: { serviceId: b.gantiOli.serviceId, name: b.gantiOli.name },
      visitDate: booking.visitDate,
      complaint: booking.complaint,
      rejectReason: null,
      workOrderNumber: null,
      handledBy: null,
      wa: { bookingConfirmed: null, bookingRejected: null },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(Date.parse(res.body.data.createdAt)).toBe(Date.parse(booking.createdAt));
    expect((await rincianBooking(b.pemilik.token, bookingId)).body).toEqual(res.body);
  });

  it('UUID tak dikenal, UUID huruf besar, dan bukan UUID → 404 not_found', async () => {
    const { bookingId } = await buatBookingPublik();

    for (const id of [randomUUID(), bookingId.toUpperCase(), 'B-0001', 'bukan-uuid']) {
      harapGalat(await rincianBooking(b.kasir.token, id), 404, 'not_found');
    }
  });

  it('urutan 401 → 403 → 404: tanpa token 401, mekanik 403 walau ID tak dikenal', async () => {
    const { bookingId } = await buatBookingPublik();

    harapGalat(await rincianBooking(undefined, randomUUID()), 401, 'unauthenticated');
    harapGalat(await rincianBooking(b.mekanik.token, randomUUID()), 403, 'forbidden');
    harapGalat(await rincianBooking(b.mekanik.token, bookingId), 403, 'forbidden');
  });
});

describe('POST /api/bookings/{bookingId}/confirm', () => {
  it('PENDING → 200 CONFIRMED, handledBy kasir, dan pesan booking_confirmed sesuai templat terkirim lalu tercatat', async () => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({
      phone: seragam,
      customerName: 'Pemesan Bernama Unik',
      vehicleBrand: 'MerekRahasia',
      vehicleModel: 'TipeRahasia',
      complaint: 'Keluhan rahasia pemesan.',
      serviceId: b.gantiOli.serviceId,
    });

    const res = await konfirmasi(b.kasir.token, bookingId);

    harapStatus(res, 200);
    const data = res.body.data;
    expect(data).toMatchObject({
      bookingId,
      status: 'CONFIRMED',
      handledBy: { staffId: b.kasir.staff.staffId, name: b.kasir.staff.name },
      rejectReason: null,
      workOrderNumber: null,
      wa: { bookingConfirmed: { status: 'sent' }, bookingRejected: null },
    });
    const harapan = pesanBookingDikonfirmasi(await outletSekarang(), {
      number: booking.number,
      plate: booking.plate,
      visitDate: booking.visitDate,
      serviceName: b.gantiOli.name,
    });
    const pesan = await waPalsu.untuk(seragam);
    expect(pesan.map((p) => p.pesan)).toEqual([harapan]);
    const [baris, ...lebih] = await barisWaBooking(booking.number);
    expect(lebih).toEqual([]);
    expect(baris).toMatchObject({
      type: 'booking_confirmed',
      phone: seragam,
      body: harapan,
      status: 'sent',
      failure_reason: null,
      work_order_id: null,
    });
    for (const teksPemesan of ['Pemesan Bernama Unik', 'MerekRahasia', 'TipeRahasia', 'Keluhan rahasia']) {
      expect(harapan).not.toContain(teksPemesan);
    }
    expect(await rincianBooking(b.kasir.token, bookingId)).toMatchObject({ body: { data: { status: 'CONFIRMED' } } });
  });

  it('booking tanpa jasa dan outlet tanpa alamat dan jam buka: baris opsional hilang', async () => {
    const outlet = await aturOutlet(b.pemilik.token, { address: '', openingHours: '' });
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({ phone: seragam, plate: 'D 1' });

    harapStatus(await konfirmasi(b.kasir.token, bookingId), 200);

    const harapan = pesanBookingDikonfirmasi(outlet, { number: booking.number, plate: 'D 1', visitDate: booking.visitDate, serviceName: null });
    expect((await waPalsu.terakhir(seragam)).pesan).toBe(harapan);
    expect(harapan.split('\n')).toHaveLength(4);
    await aturOutlet(b.pemilik.token, { address: 'Jl. Merdeka No. 10, Bandung', openingHours: 'Senin–Sabtu 08.00–17.00' });
  });

  it('nama jasa di pesan adalah salinan saat booking dibuat, bukan nama jasa sekarang', async () => {
    const jasa = await buatJasa(b.pemilik.token);
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({ phone: seragam, serviceId: jasa.serviceId });
    wajib(await api.patch(`/api/services/${jasa.serviceId}`, { token: b.pemilik.token, json: { name: `${jasa.name} Baru` } }), 200);

    harapStatus(await konfirmasi(b.kasir.token, bookingId), 200);

    expect((await waPalsu.terakhir(seragam)).pesan).toBe(
      pesanBookingDikonfirmasi(await outletSekarang(), { number: booking.number, plate: booking.plate, visitDate: booking.visitDate, serviceName: jasa.name }),
    );
  });

  it('pemilik juga boleh; badan diabaikan, termasuk JSON rusak', async () => {
    const satu = await buatBookingPublik();
    const res = await konfirmasi(b.pemilik.token, satu.bookingId, { mentah: JSON_RUSAK });

    harapStatus(res, 200);
    expect(res.body.data.handledBy).toEqual({ staffId: b.pemilik.staff.staffId, name: b.pemilik.staff.name });

    const dua = await buatBookingPublik();
    harapStatus(await konfirmasi(b.kasir.token, dua.bookingId, { json: { status: 'REJECTED' } }), 200);
    expect((await barisBooking(dua.booking.number)).status).toBe('CONFIRMED');
  });

  it('pesan gagal dikirim tidak menggagalkan konfirmasi: 200 dengan wa.bookingConfirmed failed dan baris failed beralasan', async () => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({ phone: seragam });
    await waPalsu.gangguan({ gagal: true, nomor: seragam });

    try {
      const res = await konfirmasi(b.kasir.token, bookingId);

      harapStatus(res, 200);
      expect(res.body.data).toMatchObject({ status: 'CONFIRMED', wa: { bookingConfirmed: { status: 'failed' }, bookingRejected: null } });
      const baris = await barisWaBooking(booking.number, 'booking_confirmed');
      expect(baris).toHaveLength(1);
      expect(baris[0]).toMatchObject({ status: 'failed', phone: seragam });
      expect(baris[0]?.failure_reason?.length ?? 0).toBeGreaterThan(0);
      expect((await barisBooking(booking.number)).status).toBe('CONFIRMED');
    } finally {
      await waPalsu.gangguan({ gagal: false, nomor: seragam });
    }
  });

  it('urutan 401 → 403 → 404 → 409 pada booking yang sudah dikonfirmasi', async () => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await bookingBerstatus(b, 'CONFIRMED', { phone: seragam });
    const sebelum = await jejak(booking.number, seragam);

    harapGalat(await konfirmasi(undefined, bookingId), 401, 'unauthenticated');
    harapGalat(await konfirmasi(b.mekanik.token, bookingId), 403, 'forbidden');
    harapGalat(await konfirmasi(b.mekanik.token, randomUUID()), 403, 'forbidden');
    harapGalat(await konfirmasi(b.kasir.token, randomUUID()), 404, 'not_found');
    harapGalat(await konfirmasi(b.kasir.token, bookingId.toUpperCase()), 404, 'not_found');
    harapGalat(await konfirmasi(b.kasir.token, bookingId), 409, 'booking_transition_invalid');

    expect(await jejak(booking.number, seragam)).toEqual(sebelum);
  });
});

describe('POST /api/bookings/{bookingId}/reject', () => {
  it('PENDING → 200 REJECTED dengan alasan dipangkas, handledBy, dan pesan booking_rejected sesuai templat', async () => {
    const seragam = nomorUnik();
    const { bookingId, booking, bookingToken } = await buatBookingPublik({ phone: seragam, serviceId: b.gantiOli.serviceId });

    const res = await tolak(b.kasir.token, bookingId, { reason: `  ${ALASAN_TOLAK}\n` });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({
      status: 'REJECTED',
      rejectReason: ALASAN_TOLAK,
      workOrderNumber: null,
      handledBy: { staffId: b.kasir.staff.staffId, name: b.kasir.staff.name },
      wa: { bookingConfirmed: null, bookingRejected: { status: 'sent' } },
    });
    const harapan = pesanBookingDitolak(
      await outletSekarang(),
      { number: booking.number, plate: booking.plate, visitDate: booking.visitDate, rejectReason: ALASAN_TOLAK },
      bacaEnv().publicWebUrl,
    );
    expect((await waPalsu.untuk(seragam)).map((p) => p.pesan)).toEqual([harapan]);
    const baris = await barisWaBooking(booking.number);
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ type: 'booking_rejected', phone: seragam, body: harapan, status: 'sent', failure_reason: null, work_order_id: null });
    expect((await barisBooking(booking.number)).reject_reason).toBe(ALASAN_TOLAK);
    expect((await lihatBookingPublik(bookingToken)).body.data).toMatchObject({ status: 'REJECTED', rejectReason: ALASAN_TOLAK, phone: samarkanHp(seragam) });
  });

  it('CONFIRMED → REJECTED oleh pemilik: handledBy menjadi pemilik, status pesan konfirmasi tetap tercantum', async () => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({ phone: seragam });
    await konfirmasiBooking(b.kasir.token, bookingId);

    const res = await tolak(b.pemilik.token, bookingId, { reason: 'Mekanik berhalangan.' });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'Mekanik berhalangan.',
      handledBy: { staffId: b.pemilik.staff.staffId, name: b.pemilik.staff.name },
      wa: { bookingConfirmed: { status: 'sent' }, bookingRejected: { status: 'sent' } },
    });
    expect((await barisWaBooking(booking.number)).map((w) => w.type)).toEqual(['booking_confirmed', 'booking_rejected']);
    expect((await waPalsu.untuk(seragam))).toHaveLength(2);
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['tidak dikirim', {}, 'required'],
    ['null', { reason: null }, 'required'],
    ['kosong', { reason: '' }, 'required'],
    ['hanya spasi, tab, LF', { reason: ' \t\n ' }, 'required'],
    ['angka', { reason: 123 }, 'invalid_type'],
    ['2 karakter', { reason: 'ab' }, 'too_short'],
    ['2 karakter sesudah dipangkas', { reason: '  ab  ' }, 'too_short'],
    ['501 karakter', { reason: 'x'.repeat(501) }, 'too_long'],
    ['501 code point emoji', { reason: '😀'.repeat(501) }, 'too_long'],
  ])('reason %s → 422 %s; booking tetap PENDING tanpa pesan', async (_nama, badan, kode) => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({ phone: seragam });
    const sebelum = await jejak(booking.number, seragam);

    harapGalat(await tolak(b.kasir.token, bookingId, badan), 422, 'validation_failed', { reason: kode });

    expect(await jejak(booking.number, seragam)).toEqual(sebelum);
  });

  it('reason 3 dan 500 karakter diterima apa adanya (sesudah dipangkas)', async () => {
    for (const reason of ['abc', 'y'.repeat(500)]) {
      const { bookingId } = await buatBookingPublik();
      const res = await tolak(b.kasir.token, bookingId, { reason: ` ${reason} ` });
      harapStatus(res, 200);
      expect(res.body.data.rejectReason).toBe(reason);
    }
  });

  it('urutan 413 → 400 → 401 → 403 → 404 → 422 → 409', async () => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await bookingBerstatus(b, 'CANCELLED', { phone: seragam });
    const sebelum = await jejak(booking.number, seragam);

    harapGalat(await tolak(undefined, bookingId, undefined, { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await tolak(undefined, bookingId, undefined, { mentah: JSON_RUSAK }), 400, 'bad_request');
    for (const mentah of ['[]', '"alasan"', 'null', '']) {
      harapGalat(await tolak(b.kasir.token, bookingId, undefined, { mentah }), 400, 'bad_request');
    }
    harapGalat(await tolak(undefined, bookingId, { reason: 'x' }), 401, 'unauthenticated');
    harapGalat(await tolak(b.mekanik.token, bookingId, { reason: 'x' }), 403, 'forbidden');
    harapGalat(await tolak(b.kasir.token, randomUUID(), { reason: 'x' }), 404, 'not_found');
    harapGalat(await tolak(b.kasir.token, bookingId, { reason: 'x' }), 422, 'validation_failed', { reason: 'too_short' });
    harapGalat(await tolak(b.kasir.token, bookingId, { reason: ALASAN_TOLAK }), 409, 'booking_transition_invalid');

    expect(await jejak(booking.number, seragam)).toEqual(sebelum);
  });

  it('pesan gagal dikirim tidak menggagalkan penolakan: 200 dengan wa.bookingRejected failed', async () => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({ phone: seragam });
    await waPalsu.gangguan({ gagal: true, nomor: seragam, mode: 'http-500' });

    try {
      const res = await tolak(b.kasir.token, bookingId);

      harapStatus(res, 200);
      expect(res.body.data).toMatchObject({ status: 'REJECTED', rejectReason: ALASAN_TOLAK, wa: { bookingRejected: { status: 'failed' } } });
      const baris = await barisWaBooking(booking.number, 'booking_rejected');
      expect(baris.map((w) => w.status)).toEqual(['failed']);
      expect(baris[0]?.failure_reason?.length ?? 0).toBeGreaterThan(0);
    } finally {
      await waPalsu.gangguan({ gagal: false, nomor: seragam });
    }
  });
});

describe('perpindahan status booking yang tidak tertulis → 409 booking_transition_invalid tanpa mengubah apa pun', () => {
  const KASUS: Array<['confirm' | 'reject', StatusBooking]> = [
    ['confirm', 'CONFIRMED'],
    ['confirm', 'REJECTED'],
    ['confirm', 'CANCELLED'],
    ['confirm', 'CONVERTED'],
    ['reject', 'REJECTED'],
    ['reject', 'CANCELLED'],
    ['reject', 'CONVERTED'],
  ];

  it.each(KASUS)('%s booking %s', async (aksi, status) => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await bookingBerstatus(b, status, { phone: seragam });
    const sebelum = await jejak(booking.number, seragam);

    const res = aksi === 'confirm' ? await konfirmasi(b.kasir.token, bookingId) : await tolak(b.pemilik.token, bookingId);

    harapGalat(res, 409, 'booking_transition_invalid');
    expect(await jejak(booking.number, seragam)).toEqual(sebelum);
    expect((await rincianBooking(b.kasir.token, bookingId)).body.data.status).toBe(status);
  });

  it('rejectReason hanya terisi saat REJECTED dan workOrderNumber hanya saat CONVERTED', async () => {
    for (const status of ['PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'CONVERTED'] as const) {
      const { bookingId } = await bookingBerstatus(b, status);
      const data = (await rincianBooking(b.kasir.token, bookingId)).body.data;
      expect(data.rejectReason === null, status).toBe(status !== 'REJECTED');
      expect(data.workOrderNumber === null, status).toBe(status !== 'CONVERTED');
      expect(data.handledBy === null, status).toBe(status === 'PENDING' || status === 'CANCELLED');
    }
  });
});

describe('peran: hanya pemilik dan kasir', () => {
  it('mekanik → 403 di kelima rute booking staf dan booking tidak berubah', async () => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({ phone: seragam });
    const sebelum = await jejak(booking.number, seragam);
    const spk = await jumlahBaris('work_orders');

    harapGalat(await daftarBooking(b.mekanik.token), 403, 'forbidden');
    harapGalat(await rincianBooking(b.mekanik.token, bookingId), 403, 'forbidden');
    harapGalat(await konfirmasi(b.mekanik.token, bookingId), 403, 'forbidden');
    harapGalat(await tolak(b.mekanik.token, bookingId), 403, 'forbidden');
    harapGalat(await konversi(b.mekanik.token, bookingId), 403, 'forbidden');

    expect(await jejak(booking.number, seragam)).toEqual(sebelum);
    expect(await jumlahBaris('work_orders')).toBe(spk);
  });

  it('tanpa token → 401 di kelima rute', async () => {
    const { bookingId } = await buatBookingPublik();

    harapGalat(await api.get('/api/bookings'), 401, 'unauthenticated');
    harapGalat(await rincianBooking(undefined, bookingId), 401, 'unauthenticated');
    harapGalat(await konfirmasi(undefined, bookingId), 401, 'unauthenticated');
    harapGalat(await tolak(undefined, bookingId), 401, 'unauthenticated');
    harapGalat(await konversi(undefined, bookingId), 401, 'unauthenticated');
  });

  it('pemilik dan kasir boleh membaca daftar dan rincian', async () => {
    const { bookingId } = await buatBookingPublik();

    for (const token of [b.pemilik.token, b.kasir.token]) {
      harapStatus(await daftarBooking(token), 200);
      harapStatus(await rincianBooking(token, bookingId), 200);
    }
  });
});
