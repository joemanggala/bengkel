// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import {
  buatBookingPublik,
  buatJasa,
  buatKasir,
  isianBooking,
  jadikanSpk,
  konfirmasiBooking,
  nomorUnik,
  platUnik,
  siapkanBengkel,
  tolakBooking,
  wajib,
  type Bengkel,
} from '../src/data';
import { aturPenghitung, barisBooking, jumlahBaris, nilaiPenghitung, sha256Hex, waktuDatabase } from '../src/db';
import { nomorBooking, samarkanHp } from '../src/format';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { waPalsu } from '../src/wa';
import {
  badanBersarang,
  batalkanBookingPublik,
  bookingBerstatus,
  daftarBooking,
  FIELD_BOOKING_PUBLIK,
  gantiHashToken,
  kirimBooking,
  kolomBookingMemuat,
  lihatBookingPublik,
  POLA_TOKEN,
  rincianBooking,
  tanggalWibAman,
  tokenAcak,
  tokenBentukBuruk,
  tukarHuruf,
  variasiHp,
} from './pembantu-booking';
import { badanUtf8Rusak, JSON_RUSAK, jsonLebihDariSatuMib } from './pembantu-fondasi';

// Booking dari website tanpa akun: membuat, token booking, batas 3 booking
// menunggu per nomor HP, melihat, dan membatalkan. Validasi tiap field ada di
// booking-publik-validasi.test.ts. Setiap booking memakai nomor HP dan plat
// unik, jadi batas 3 menunggu hanya berlaku di tes yang sengaja mengujinya.

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
});

async function jumlahPermintaanWa(): Promise<number> {
  return (await waPalsu.permintaan()).length;
}

describe('POST /api/public/bookings: 201', () => {
  it('membalas token 43 karakter dan BookingPublik PENDING berisi salinan isian yang dirapikan', async () => {
    const tgl = await tanggalWibAman(1);
    const seragam = nomorUnik();
    const plat = platUnik();
    const sebelum = await waktuDatabase();

    const res = await kirimBooking({
      customerName: '  Budi Santoso \t',
      phone: variasiHp(seragam).lokal,
      vehicleType: 'MOTOR',
      plate: `  ${plat.toLowerCase().replace(/ /g, '-')} `,
      vehicleBrand: ' Honda ',
      vehicleModel: ' Vario 125 ',
      serviceId: b.gantiOli.serviceId,
      visitDate: tgl,
      complaint: '\n Rem depan bunyi.\nKadang macet. \r\n',
    });

    harapStatus(res, 201);
    expect(Object.keys(res.body.data).sort()).toEqual(['booking', 'bookingToken']);
    expect(res.body.data.bookingToken).toMatch(POLA_TOKEN);
    const booking = res.body.data.booking;
    expect(Object.keys(booking).sort()).toEqual([...FIELD_BOOKING_PUBLIK].sort());
    expect(booking).toEqual({
      number: expect.stringMatching(/^B-[0-9]{4,}$/),
      status: 'PENDING',
      customerName: 'Budi Santoso',
      phone: samarkanHp(seragam),
      vehicleType: 'MOTOR',
      plate: plat,
      vehicleBrand: 'Honda',
      vehicleModel: 'Vario 125',
      serviceName: b.gantiOli.name,
      visitDate: tgl,
      complaint: 'Rem depan bunyi.\nKadang macet.',
      rejectReason: null,
      workOrderNumber: null,
      createdAt: expect.any(String),
    });
    expect(Math.abs(Date.parse(booking.createdAt) - sebelum.getTime())).toBeLessThan(60_000);
  });

  it('nomor booking berurutan dari penghitung, diisi nol sampai 4 digit, dan B-9999 diikuti B-10000', async () => {
    const n = await nilaiPenghitung('booking_number');

    expect((await buatBookingPublik()).booking.number).toBe(nomorBooking(n + 1));
    expect((await buatBookingPublik()).booking.number).toBe(nomorBooking(n + 2));

    await aturPenghitung('booking_number', 9998);
    expect((await buatBookingPublik()).booking.number).toBe('B-9999');
    expect((await buatBookingPublik()).booking.number).toBe('B-10000');
    expect(await nilaiPenghitung('booking_number')).toBe(10000);
  });

  it('database hanya menyimpan hex SHA-256 token; token apa adanya tidak ada di kolom mana pun', async () => {
    const { bookingToken, booking } = await buatBookingPublik();

    const baris = await barisBooking(booking.number);

    expect(baris.booking_token_hash).toBe(sha256Hex(bookingToken));
    expect(await kolomBookingMemuat(booking.number, bookingToken)).toEqual([]);
  });

  it('baris booking menyimpan nomor seragam, kunci dan tampilan plat, salinan nama jasa, PENDING, tanpa staf dan SPK', async () => {
    const seragam = nomorUnik();
    const tgl = await tanggalWibAman(30);
    const { booking } = await buatBookingPublik({
      phone: variasiHp(seragam).internasional,
      plate: 'b.1234-xyz',
      vehicleType: 'CAR',
      serviceId: b.gantiOli.serviceId,
      visitDate: tgl,
    });

    expect(await barisBooking(booking.number)).toMatchObject({
      customer_phone: seragam,
      vehicle_type: 'CAR',
      plate_key: 'B1234XYZ',
      plate_display: 'B 1234 XYZ',
      service_id: b.gantiOli.serviceId,
      service_name: b.gantiOli.name,
      visit_date: tgl,
      status: 'PENDING',
      reject_reason: null,
      work_order_id: null,
      handled_by_staff_id: null,
    });
  });

  it('tanpa jasa: serviceName null; vehicleModel yang tidak dikirim menjadi string kosong', async () => {
    const isian = await isianBooking();
    delete isian.vehicleModel;

    const res = await kirimBooking(isian);

    harapStatus(res, 201);
    expect(res.body.data.booking).toMatchObject({ serviceName: null, vehicleModel: '' });
    expect(await barisBooking(res.body.data.booking.number)).toMatchObject({ service_id: null, service_name: null, vehicle_model: '' });
  });

  it('token tiap booking berbeda dan hanya dikirim sekali: lihat publik, rincian staf, dan daftar staf tidak memuatnya', async () => {
    const semua = [await buatBookingPublik(), await buatBookingPublik(), await buatBookingPublik()];
    expect(new Set(semua.map((x) => x.bookingToken)).size).toBe(3);

    for (const { bookingToken, bookingId } of semua) {
      const hash = sha256Hex(bookingToken);
      for (const res of [await lihatBookingPublik(bookingToken), await rincianBooking(b.kasir.token, bookingId), await daftarBooking(b.kasir.token)]) {
        harapStatus(res, 200);
        expect(res.teks).not.toContain(bookingToken);
        expect(res.teks).not.toContain(hash);
      }
    }
  });

  it('token yang hash-nya disisipkan langsung ke database dengan aturan bersama diterima; token lama tidak lagi', async () => {
    const { bookingToken, booking } = await buatBookingPublik();
    const lain = tokenAcak();

    await gantiHashToken(booking.number, lain);

    const res = await lihatBookingPublik(lain);
    harapStatus(res, 200);
    expect(res.body.data.number).toBe(booking.number);
    harapGalat(await lihatBookingPublik(bookingToken), 404, 'not_found');
  });

  it('pelanggan dan kendaraan tidak dibuat saat booking, walau nomor HP sudah milik pelanggan', async () => {
    const pelanggan = await jumlahBaris('customers');
    const kendaraan = await jumlahBaris('vehicles');

    await buatBookingPublik();
    await buatBookingPublik({ phone: b.pelanggan.phone, plate: b.kendaraan.plate });

    expect(await jumlahBaris('customers')).toBe(pelanggan);
    expect(await jumlahBaris('vehicles')).toBe(kendaraan);
  });

  it('tidak ada WhatsApp dari form publik: membuat, melihat, dan membatalkan tidak mengirim atau mencatat pesan', async () => {
    const seragam = nomorUnik();
    const permintaan = await jumlahPermintaanWa();

    const { bookingToken, booking } = await buatBookingPublik({ phone: seragam });
    harapStatus(await lihatBookingPublik(bookingToken), 200);
    harapStatus(await batalkanBookingPublik(bookingToken), 200);

    expect(await waPalsu.untuk(seragam)).toEqual([]);
    expect(await jumlahPermintaanWa()).toBe(permintaan);
    expect(await jumlahBaris('wa_messages', 'booking_id = (SELECT booking_id FROM bookings WHERE number = ?)', [booking.number])).toBe(0);
  });

  it('field yang tidak dikenal diabaikan: status, nomor, token, alasan, dan staf dari badan tidak dipakai', async () => {
    const palsu = tokenAcak();
    const isian = await isianBooking({
      status: 'CONFIRMED',
      number: 'B-0001',
      bookingToken: palsu,
      bookingId: randomUUID(),
      rejectReason: 'x',
      workOrderNumber: 'S-0001',
      handledBy: { staffId: b.kasir.staff.staffId, name: 'Kasir' },
    });

    const res = await kirimBooking(isian);

    harapStatus(res, 201);
    expect(res.body.data.bookingToken).not.toBe(palsu);
    expect(res.body.data.booking).toMatchObject({ status: 'PENDING', rejectReason: null, workOrderNumber: null });
    expect(res.body.data.booking.number).not.toBe('B-0001');
    expect(await barisBooking(res.body.data.booking.number)).toMatchObject({ status: 'PENDING', handled_by_staff_id: null });
  });

  it('Authorization diabaikan: dengan token kasir tetap 201 dan booking tidak tercatat ditangani staf', async () => {
    const res = await kirimBooking(await isianBooking(), { token: b.kasir.token });

    harapStatus(res, 201);
    expect(await barisBooking(res.body.data.booking.number)).toMatchObject({ handled_by_staff_id: null, status: 'PENDING' });
  });

  it('nama jasa di booking adalah salinan saat dibuat: mengganti nama jasa sesudahnya tidak mengubah booking', async () => {
    const jasa = await buatJasa(b.pemilik.token);
    const { bookingToken, bookingId } = await buatBookingPublik({ serviceId: jasa.serviceId });

    wajib(await api.patch(`/api/services/${jasa.serviceId}`, { token: b.pemilik.token, json: { name: `${jasa.name} Baru` } }), 200);

    expect((await lihatBookingPublik(bookingToken)).body.data.serviceName).toBe(jasa.name);
    expect((await rincianBooking(b.kasir.token, bookingId)).body.data.service).toEqual({ serviceId: jasa.serviceId, name: jasa.name });
  });
});

describe('POST /api/public/bookings: urutan 413 → 400 → 422 → 409', () => {
  it('badan lebih dari 1 MiB → 413, juga bila isinya JSON rusak; tidak ada booking dan nomor terpakai', async () => {
    const n = await nilaiPenghitung('booking_number');
    const jumlah = await jumlahBaris('bookings');

    harapGalat(await api.post('/api/public/bookings', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.post('/api/public/bookings', { mentah: `${JSON_RUSAK}${'a'.repeat(1024 * 1024 + 10)}` }), 413, 'payload_too_large');

    expect(await nilaiPenghitung('booking_number')).toBe(n);
    expect(await jumlahBaris('bookings')).toBe(jumlah);
  });

  it.each([
    ['JSON rusak', JSON_RUSAK],
    ['larik', '[]'],
    ['string', '"teks"'],
    ['angka', '123'],
    ['boolean', 'true'],
    ['null', 'null'],
    ['badan kosong', ''],
  ])('badan bukan objek JSON (%s) → 400 bad_request', async (_nama, mentah) => {
    harapGalat(await api.post('/api/public/bookings', { mentah }), 400, 'bad_request');
  });

  it('byte UTF-8 tidak sah, surrogat tunggal, dan 65 tingkat → 400; tepat 64 tingkat (objek badan + 63 larik) lolos', async () => {
    harapGalat(await api.post('/api/public/bookings', { biner: badanUtf8Rusak() }), 400, 'bad_request');

    const isian = await isianBooking({ customerName: 'BuXXdi' });
    const surrogat = JSON.stringify(isian).replace('BuXXdi', 'Bu\\ud800di');
    harapGalat(await api.post('/api/public/bookings', { mentah: surrogat }), 400, 'bad_request');

    harapGalat(await api.post('/api/public/bookings', { mentah: badanBersarang(isian, 64) }), 400, 'bad_request');
    harapStatus(await api.post('/api/public/bookings', { mentah: badanBersarang(isian, 63) }), 201);
  });

  it('422 dinilai sebelum 409: nomor yang sudah punya 3 booking menunggu dengan plat salah → 422, isian sah → 409', async () => {
    const seragam = nomorUnik();
    for (let i = 0; i < 3; i += 1) {
      await buatBookingPublik({ phone: seragam });
    }

    harapGalat(await kirimBooking(await isianBooking({ phone: seragam, plate: 'B' })), 422, 'validation_failed', { plate: 'too_short' });
    harapGalat(await kirimBooking(await isianBooking({ phone: seragam })), 409, 'too_many_pending_bookings');
  });
});

describe('409 too_many_pending_bookings: paling banyak 3 booking PENDING per nomor HP', () => {
  it('nomor yang sama dalam bentuk apa pun dihitung satu; booking ke-4 ditolak tanpa menyimpan dan tanpa memakai nomor booking', async () => {
    const seragam = nomorUnik();
    const v = variasiHp(seragam);
    for (const phone of [v.lokal, v.internasional, v.polos]) {
      await buatBookingPublik({ phone });
    }
    const n = await nilaiPenghitung('booking_number');
    const jumlah = await jumlahBaris('bookings');

    for (const phone of [v.lokal, v.internasional, v.polos, `0${seragam.slice(2)}`, `62-${seragam.slice(2)}`]) {
      harapGalat(await kirimBooking(await isianBooking({ phone })), 409, 'too_many_pending_bookings');
    }

    expect(await nilaiPenghitung('booking_number')).toBe(n);
    expect(await jumlahBaris('bookings')).toBe(jumlah);
    expect(await jumlahBaris('bookings', 'customer_phone = ?', [seragam])).toBe(3);
    // Nomor lain tidak terpengaruh dan mendapat nomor booking berikutnya tanpa celah.
    expect((await buatBookingPublik()).booking.number).toBe(nomorBooking(n + 1));
  });

  it('hanya PENDING yang dihitung: dikonfirmasi, dibatalkan, ditolak, dan dijadikan SPK masing-masing membuka satu tempat', async () => {
    const seragam = nomorUnik();
    const tolakLagi = async () => harapGalat(await kirimBooking(await isianBooking({ phone: seragam })), 409, 'too_many_pending_bookings');
    const bk = [await buatBookingPublik({ phone: seragam }), await buatBookingPublik({ phone: seragam }), await buatBookingPublik({ phone: seragam })];
    await tolakLagi();

    await konfirmasiBooking(b.kasir.token, bk[0]!.bookingId);
    bk.push(await buatBookingPublik({ phone: seragam }));
    await tolakLagi();

    wajib(await batalkanBookingPublik(bk[1]!.bookingToken), 200);
    bk.push(await buatBookingPublik({ phone: seragam }));
    await tolakLagi();

    await tolakBooking(b.kasir.token, bk[2]!.bookingId);
    bk.push(await buatBookingPublik({ phone: seragam }));
    await tolakLagi();

    await jadikanSpk(b.kasir.token, bk[3]!.bookingId);
    bk.push(await buatBookingPublik({ phone: seragam }));
    await tolakLagi();

    expect(await jumlahBaris('bookings', "customer_phone = ? AND status = 'PENDING'", [seragam])).toBe(3);
  });
});

describe('GET /api/public/bookings/{bookingToken}', () => {
  it('200 BookingPublik yang sama dengan balasan saat membuat, dengan nomor HP tersamar', async () => {
    const seragam = nomorUnik();
    const { bookingToken, booking } = await buatBookingPublik({ phone: seragam, serviceId: b.gantiOli.serviceId });

    const res = await lihatBookingPublik(bookingToken);

    harapStatus(res, 200);
    expect(Object.keys(res.body.data).sort()).toEqual([...FIELD_BOOKING_PUBLIK].sort());
    harapSetara(res.body.data, booking);
    expect(res.body.data.phone).toBe(samarkanHp(seragam));
  });

  it('mengikuti status: CONFIRMED, lalu REJECTED dengan rejectReason dipangkas', async () => {
    const { bookingToken, bookingId } = await buatBookingPublik();

    await konfirmasiBooking(b.kasir.token, bookingId);
    expect((await lihatBookingPublik(bookingToken)).body.data).toMatchObject({ status: 'CONFIRMED', rejectReason: null, workOrderNumber: null });

    await tolakBooking(b.pemilik.token, bookingId, '  Bengkel tutup tanggal itu.  ');
    expect((await lihatBookingPublik(bookingToken)).body.data).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'Bengkel tutup tanggal itu.',
      workOrderNumber: null,
    });
  });

  it('booking yang dijadikan SPK: CONVERTED dengan workOrderNumber, tanpa token lacak', async () => {
    const { bookingToken, bookingId } = await buatBookingPublik();
    const { workOrder } = await jadikanSpk(b.kasir.token, bookingId);

    const res = await lihatBookingPublik(bookingToken);

    expect(res.body.data).toMatchObject({ status: 'CONVERTED', workOrderNumber: workOrder.number, rejectReason: null });
    expect(res.teks).not.toContain(workOrder.trackingToken);
  });

  it('tanpa data staf, ID, nomor HP utuh, hash token, dan data pelanggan/kendaraan/SPK di database', async () => {
    const kasir = await buatKasir({ name: 'Kasir Rahasia Bengkel' });
    const seragam = nomorUnik();
    const { bookingToken, bookingId } = await buatBookingPublik({ phone: seragam, serviceId: b.gantiOli.serviceId });
    await konfirmasiBooking(kasir.token, bookingId);
    const { workOrder } = await jadikanSpk(b.pemilik.token, bookingId);

    const res = await lihatBookingPublik(bookingToken);

    harapStatus(res, 200);
    expect(Object.keys(res.body.data).sort()).toEqual([...FIELD_BOOKING_PUBLIK].sort());
    for (const rahasia of [
      kasir.staff.name,
      kasir.staff.staffId,
      kasir.staff.email,
      b.pemilik.staff.staffId,
      b.pemilik.staff.email,
      bookingId,
      seragam,
      sha256Hex(bookingToken),
      b.gantiOli.serviceId,
      workOrder.trackingToken,
      workOrder.customer.customerId,
      workOrder.vehicle.vehicleId,
    ]) {
      expect(res.teks, rahasia).not.toContain(rahasia);
    }
  });

  it('Authorization diabaikan: tanpa header, token staf, atau header sampah → balasan sama', async () => {
    const { bookingToken } = await buatBookingPublik();
    const polos = await lihatBookingPublik(bookingToken);

    for (const opsi of [{ token: b.pemilik.token }, { token: b.mekanik.token }, { token: tokenAcak() }, { header: { Authorization: 'sampah' } }]) {
      const res = await lihatBookingPublik(bookingToken, opsi);
      harapStatus(res, 200);
      expect(res.body).toEqual(polos.body);
    }
  });

  it('token tak dikenal, beda huruf besar/kecil, hash-nya sendiri, dan token lacak SPK → 404 not_found', async () => {
    const { bookingToken } = await buatBookingPublik();
    const { workOrder } = await jadikanSpk(b.kasir.token, (await buatBookingPublik()).bookingId);
    const tukar = tukarHuruf(bookingToken);

    for (const token of [tokenAcak(), sha256Hex(bookingToken).slice(0, 43), workOrder.trackingToken, ...(tukar ? [tukar] : [])]) {
      harapGalat(await lihatBookingPublik(token), 404, 'not_found');
    }
  });

  it.each(tokenBentukBuruk())('token salah bentuk (%s) → 404 not_found', async (_nama, token) => {
    harapGalat(await lihatBookingPublik(token), 404, 'not_found');
  });
});

describe('POST /api/public/bookings/{bookingToken}/cancel', () => {
  it('PENDING → 200 CANCELLED; booking lain tetap; staf melihat handledBy null dan tanpa pesan WhatsApp', async () => {
    const { bookingToken, booking, bookingId } = await buatBookingPublik();
    const permintaan = await jumlahPermintaanWa();

    const res = await batalkanBookingPublik(bookingToken);

    harapStatus(res, 200);
    harapSetara(res.body.data, { ...booking, status: 'CANCELLED' });
    expect((await lihatBookingPublik(bookingToken)).body.data.status).toBe('CANCELLED');
    expect((await rincianBooking(b.kasir.token, bookingId)).body.data).toMatchObject({
      status: 'CANCELLED',
      handledBy: null,
      rejectReason: null,
      workOrderNumber: null,
      wa: { bookingConfirmed: null, bookingRejected: null },
    });
    expect((await barisBooking(booking.number)).status).toBe('CANCELLED');
    expect(await jumlahPermintaanWa()).toBe(permintaan);
  });

  it.each(['CANCELLED', 'CONFIRMED', 'REJECTED', 'CONVERTED'] as const)(
    'booking %s → 409 booking_transition_invalid dan statusnya tidak berubah',
    async (status) => {
      const { bookingToken, booking } = await bookingBerstatus(b, status);
      const sebelum = await barisBooking(booking.number);

      harapGalat(await batalkanBookingPublik(bookingToken), 409, 'booking_transition_invalid');

      const sesudah = await barisBooking(booking.number);
      expect({ status: sesudah.status, staf: sesudah.handled_by_staff_id }).toEqual({ status: sebelum.status, staf: sebelum.handled_by_staff_id });
      expect((await lihatBookingPublik(bookingToken)).body.data.status).toBe(status);
    },
  );

  it('badan diabaikan, termasuk JSON rusak dan badan lebih dari 1 MiB (tanpa 400/413): PENDING tetap 200; Authorization juga diabaikan', async () => {
    const satu = await buatBookingPublik();
    harapStatus(await batalkanBookingPublik(satu.bookingToken, { mentah: JSON_RUSAK }), 200);
    const besar = await buatBookingPublik();
    harapStatus(await batalkanBookingPublik(besar.bookingToken, { mentah: `${JSON_RUSAK}${jsonLebihDariSatuMib()}` }), 200);
    harapGalat(await batalkanBookingPublik(tokenAcak(), { mentah: jsonLebihDariSatuMib() }), 404, 'not_found');

    const dua = await buatBookingPublik();
    harapStatus(await batalkanBookingPublik(dua.bookingToken, { token: b.kasir.token, json: { status: 'CONFIRMED' } }), 200);
    expect(await barisBooking(dua.booking.number)).toMatchObject({ status: 'CANCELLED', handled_by_staff_id: null });
  });

  it('404 dinilai sebelum 409: token tak dikenal, beda huruf, dan token lacak SPK → 404', async () => {
    const { bookingToken } = await bookingBerstatus(b, 'CANCELLED');
    const { workOrder } = await jadikanSpk(b.kasir.token, (await buatBookingPublik()).bookingId);
    const tukar = tukarHuruf(bookingToken);

    for (const token of [tokenAcak(), workOrder.trackingToken, ...(tukar ? [tukar] : [])]) {
      harapGalat(await batalkanBookingPublik(token), 404, 'not_found');
    }
  });

  it.each(tokenBentukBuruk())('token salah bentuk (%s) → 404 not_found', async (_nama, token) => {
    harapGalat(await batalkanBookingPublik(token), 404, 'not_found');
  });
});
