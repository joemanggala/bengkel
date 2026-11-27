// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import {
  buatBookingPublik,
  buatJasa,
  buatPelanggan,
  buatPelangganDenganKendaraan,
  detailSpk,
  konfirmasiBooking,
  nomorUnik,
  platUnik,
  siapkanBengkel,
  wajib,
  type Bengkel,
} from '../src/data';
import { barisBooking, barisItemSpk, barisSpk, barisWaBooking, barisWaSpk, idSpk, jumlahBaris, nilaiPenghitung } from '../src/db';
import { bacaEnv } from '../src/env';
import { nomorSpk, pesanSpkDibuat, plat, tautanLacak } from '../src/format';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { waPalsu } from '../src/wa';
import { jejakKonversi, konversi, lihatBookingPublik, POLA_TOKEN, rincianBooking, variasiHp } from './pembantu-booking';

// POST /api/bookings/{bookingId}/convert yang berhasil: booking menjadi SPK,
// pelanggan dan kendaraan dipakai ulang atau dibuat, jasa booking menjadi item
// pertama, pesan work_order_created, dan 409 plate_owned_by_other_customer.
// Urutan pemeriksaan, validasi badan, dan perpindahan yang tidak sah ada di
// konversi-booking-validasi.test.ts.

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
});

async function jadikan(token: string, bookingId: string, badan: Record<string, unknown> = {}): Promise<{ booking: any; workOrder: any }> {
  const res = await konversi(token, bookingId, badan);
  harapStatus(res, 201);
  expect(Object.keys(res.body.data).sort()).toEqual(['booking', 'workOrder']);
  return res.body.data;
}

async function pelanggan(customerId: string): Promise<any> {
  return wajib(await api.get(`/api/customers/${customerId}`, { token: b.kasir.token }), 200).body.data;
}

async function outletSekarang(): Promise<any> {
  return wajib(await api.get('/api/outlet'), 200).body.data;
}

describe('booking menjadi SPK', () => {
  it('dari PENDING: booking CONVERTED dengan workOrderNumber dan handledBy; SPK QUEUED dengan keluhan booking dan satu baris linimasa', async () => {
    const { bookingId, booking, bookingToken } = await buatBookingPublik({ complaint: ' Rem depan bunyi.\nKadang macet. ' });
    const n = await nilaiPenghitung('work_order_number');
    const kasir = { staffId: b.kasir.staff.staffId, name: b.kasir.staff.name };

    const hasil = await jadikan(b.kasir.token, bookingId);

    const nomor = nomorSpk(n + 1);
    expect(hasil.booking).toMatchObject({ bookingId, number: booking.number, status: 'CONVERTED', workOrderNumber: nomor, handledBy: kasir, rejectReason: null });
    const spk = hasil.workOrder;
    expect(spk).toMatchObject({
      number: nomor,
      status: 'QUEUED',
      booking: { bookingId, number: booking.number },
      mechanic: null,
      complaint: 'Rem depan bunyi.\nKadang macet.',
      diagnosis: '',
      odometer: null,
      estimatedDoneAt: null,
      serviceSubtotal: 0,
      partSubtotal: 0,
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      // StatusBayar: bertotal 0 berarti paid.
      paymentStatus: 'paid',
      cancelReason: null,
      createdBy: kasir,
      items: [],
      payments: [],
    });
    expect(spk.trackingToken).toMatch(POLA_TOKEN);
    expect(spk.timeline).toHaveLength(1);
    expect(spk.timeline[0]).toMatchObject({ fromStatus: null, toStatus: 'QUEUED', by: kasir, note: '' });

    harapSetara(await detailSpk(b.kasir.token, nomor), spk);
    harapSetara((await rincianBooking(b.kasir.token, bookingId)).body.data, hasil.booking);
    expect((await barisBooking(booking.number)).work_order_id).toBe(await idSpk(nomor));
    expect(await barisSpk(nomor)).toMatchObject({ tracking_token: spk.trackingToken, created_by_staff_id: b.kasir.staff.staffId, status: 'QUEUED' });
    expect((await lihatBookingPublik(bookingToken)).body.data).toMatchObject({ status: 'CONVERTED', workOrderNumber: nomor });
  });

  it('dari CONFIRMED: handledBy menjadi staf yang menjadikan SPK; status pesan konfirmasi tetap tercantum', async () => {
    const { bookingId } = await buatBookingPublik();
    await konfirmasiBooking(b.kasir.token, bookingId);

    const hasil = await jadikan(b.pemilik.token, bookingId);

    expect(hasil.booking).toMatchObject({
      status: 'CONVERTED',
      handledBy: { staffId: b.pemilik.staff.staffId, name: b.pemilik.staff.name },
      wa: { bookingConfirmed: { status: 'sent' }, bookingRejected: null },
    });
    expect(hasil.workOrder.createdBy).toEqual({ staffId: b.pemilik.staff.staffId, name: b.pemilik.staff.name });
  });

  it('mechanicId, odometer, dan estimatedDoneAt dari badan dipakai; complaint dan vehicleId di badan diabaikan', async () => {
    const { bookingId, booking } = await buatBookingPublik();

    const { workOrder } = await jadikan(b.kasir.token, bookingId, {
      mechanicId: b.mekanik.staff.staffId,
      odometer: 18250,
      estimatedDoneAt: '2026-12-01T15:00:00+07:00',
      complaint: 'Keluhan lain dari badan.',
      vehicleId: b.kendaraan.vehicleId,
    });

    expect(workOrder).toMatchObject({ mechanic: { staffId: b.mekanik.staff.staffId, name: b.mekanik.staff.name }, odometer: 18250, complaint: booking.complaint });
    expect(Date.parse(workOrder.estimatedDoneAt)).toBe(Date.parse('2026-12-01T08:00:00.000Z'));
    expect(workOrder.vehicle.vehicleId).not.toBe(b.kendaraan.vehicleId);
  });
});

describe('pelanggan dicari dari nomor HP booking', () => {
  it('nomor baru: pelanggan dibuat dengan nama dan nomor seragam dari booking, alamat dan catatan kosong', async () => {
    const seragam = nomorUnik();
    const { bookingId } = await buatBookingPublik({ customerName: '  Siti Aminah ', phone: variasiHp(seragam).lokal });
    const jumlah = await jumlahBaris('customers');

    const { workOrder } = await jadikan(b.kasir.token, bookingId);

    expect(await jumlahBaris('customers')).toBe(jumlah + 1);
    expect(workOrder.customer).toMatchObject({ name: 'Siti Aminah', phone: seragam });
    const p = await pelanggan(workOrder.customer.customerId);
    expect(p).toMatchObject({ name: 'Siti Aminah', phone: seragam, address: '', notes: '' });
    expect(p.vehicles.map((v: any) => v.vehicleId)).toEqual([workOrder.vehicle.vehicleId]);
  });

  it('nomor milik pelanggan (diketik dalam bentuk lain): pelanggan dipakai apa adanya, namanya tidak ditimpa', async () => {
    const lama = await buatPelanggan(b.kasir.token, { name: 'Pak Haji Lama', address: 'Jl. Lama 1', notes: 'Langganan' });
    const { bookingId } = await buatBookingPublik({ customerName: 'Budi Baru', phone: variasiHp(lama.phone).internasional });
    const jumlah = await jumlahBaris('customers');

    const { workOrder } = await jadikan(b.kasir.token, bookingId);

    expect(await jumlahBaris('customers')).toBe(jumlah);
    expect(workOrder.customer).toEqual({ customerId: lama.customerId, name: 'Pak Haji Lama', phone: lama.phone });
    const p = await pelanggan(lama.customerId);
    expect(p).toMatchObject({ name: 'Pak Haji Lama', address: 'Jl. Lama 1', notes: 'Langganan' });
    expect(p.vehicles.map((v: any) => v.vehicleId)).toEqual([workOrder.vehicle.vehicleId]);
  });
});

describe('kendaraan dicari dari kunci plat booking', () => {
  it('plat baru: kendaraan dibuat untuk pelanggan itu dengan jenis, plat, merek, dan tipe dari booking; tahun null, warna kosong', async () => {
    const { bookingId } = await buatBookingPublik({ vehicleType: 'CAR', plate: 'd 1-ab', vehicleBrand: 'Toyota', vehicleModel: '' });
    const jumlah = await jumlahBaris('vehicles');

    const { workOrder } = await jadikan(b.kasir.token, bookingId);

    expect(await jumlahBaris('vehicles')).toBe(jumlah + 1);
    expect(workOrder.vehicle).toEqual({ vehicleId: expect.any(String), type: 'CAR', plate: 'D 1 AB', brand: 'Toyota', model: '', year: null, color: '' });
    const [kendaraan] = (await pelanggan(workOrder.customer.customerId)).vehicles;
    expect(kendaraan).toMatchObject({ vehicleId: workOrder.vehicle.vehicleId, customerId: workOrder.customer.customerId, plateKey: 'D1AB', plate: 'D 1 AB' });
  });

  it('plat milik pelanggan yang sama (diketik dalam bentuk lain): kendaraan dipakai apa adanya tanpa ditimpa', async () => {
    const { pelanggan: milik, kendaraan } = await buatPelangganDenganKendaraan(
      b.kasir.token,
      {},
      { plate: platUnik('F'), brand: 'Yamaha', model: 'NMAX', year: 2020, color: 'Hitam' },
    );
    const ketik = kendaraan.plate.toLowerCase().replace(/ /g, '');
    const { bookingId } = await buatBookingPublik({ phone: variasiHp(milik.phone).lokal, plate: ketik, vehicleBrand: 'Honda', vehicleModel: 'Vario', vehicleType: 'CAR' });
    const jumlah = await jumlahBaris('vehicles');

    const { workOrder } = await jadikan(b.kasir.token, bookingId);

    expect(await jumlahBaris('vehicles')).toBe(jumlah);
    expect(workOrder.customer.customerId).toBe(milik.customerId);
    expect(workOrder.vehicle).toEqual({ vehicleId: kendaraan.vehicleId, type: 'MOTOR', plate: kendaraan.plate, brand: 'Yamaha', model: 'NMAX', year: 2020, color: 'Hitam' });
  });

  it('pelanggan lama dengan plat baru: kendaraan baru ditambahkan ke pelanggan itu', async () => {
    const { pelanggan: milik, kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token);
    const baru = platUnik('L');
    const { bookingId } = await buatBookingPublik({ phone: milik.phone, plate: baru });

    const { workOrder } = await jadikan(b.kasir.token, bookingId);

    expect(workOrder.vehicle.plate).toBe(plat(baru).tampilan);
    const p = await pelanggan(milik.customerId);
    expect(p.vehicles.map((v: any) => v.vehicleId)).toEqual([kendaraan.vehicleId, workOrder.vehicle.vehicleId]);
  });
});

describe('409 plate_owned_by_other_customer: tidak ada yang berubah', () => {
  it.each(['PENDING', 'CONFIRMED'] as const)('booking %s dengan nomor baru dan plat milik pelanggan lain → 409; pelanggan baru tidak tersimpan', async (status) => {
    const { kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token);
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({ phone: seragam, plate: kendaraan.plateKey.toLowerCase() });
    if (status === 'CONFIRMED') {
      await konfirmasiBooking(b.kasir.token, bookingId);
    }
    const sebelum = await jejakKonversi(booking.number);
    const pesan = (await waPalsu.untuk(seragam)).length;

    harapGalat(await konversi(b.kasir.token, bookingId), 409, 'plate_owned_by_other_customer');

    expect(await jejakKonversi(booking.number)).toEqual(sebelum);
    expect(await jumlahBaris('customers', 'phone = ?', [seragam])).toBe(0);
    expect((await waPalsu.untuk(seragam)).length).toBe(pesan);
    expect((await barisBooking(booking.number)).status).toBe(status);
  });

  it('nomor milik pelanggan A tetapi plat milik pelanggan B → 409', async () => {
    const a = await buatPelanggan(b.kasir.token);
    const { kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token);
    const { bookingId, booking } = await buatBookingPublik({ phone: a.phone, plate: kendaraan.plate });
    const sebelum = await jejakKonversi(booking.number);

    harapGalat(await konversi(b.kasir.token, bookingId), 409, 'plate_owned_by_other_customer');

    expect(await jejakKonversi(booking.number)).toEqual(sebelum);
    expect((await pelanggan(a.customerId)).vehicles).toEqual([]);
  });
});

describe('jasa booking menjadi item pertama', () => {
  it('jasa aktif: item SERVICE jumlah 1 dengan harga katalog dan nama saat konversi, bukan saat booking', async () => {
    const jasa = await buatJasa(b.pemilik.token, { price: 40000 });
    const { bookingId } = await buatBookingPublik({ serviceId: jasa.serviceId });
    wajib(await api.patch(`/api/services/${jasa.serviceId}`, { token: b.pemilik.token, json: { name: `${jasa.name} Baru`, price: 45000 } }), 200);

    const { booking, workOrder } = await jadikan(b.kasir.token, bookingId);

    expect(workOrder.items).toHaveLength(1);
    expect(workOrder.items[0]).toMatchObject({ type: 'SERVICE', serviceId: jasa.serviceId, partId: null, name: `${jasa.name} Baru`, price: 45000, quantity: 1, subtotal: 45000 });
    expect(workOrder).toMatchObject({ serviceSubtotal: 45000, partSubtotal: 0, total: 45000, paidAmount: 0, remainingAmount: 45000, paymentStatus: 'unpaid' });
    expect(booking.service).toEqual({ serviceId: jasa.serviceId, name: jasa.name });
    expect((await barisItemSpk(workOrder.number)).map((i) => [i.line_no, i.type, i.price, i.quantity])).toEqual([[1, 'SERVICE', 45000, 1]]);
  });

  it('jasa yang sudah tidak tampil di website tetapi masih aktif tetap menjadi item', async () => {
    const jasa = await buatJasa(b.pemilik.token, { price: 30000 });
    const { bookingId } = await buatBookingPublik({ serviceId: jasa.serviceId });
    wajib(await api.patch(`/api/services/${jasa.serviceId}`, { token: b.pemilik.token, json: { isPublic: false } }), 200);

    const { workOrder } = await jadikan(b.kasir.token, bookingId);

    expect(workOrder.items.map((i: any) => [i.serviceId, i.price])).toEqual([[jasa.serviceId, 30000]]);
  });

  it('jasa yang sudah nonaktif dilewati tanpa galat: SPK tanpa item', async () => {
    const jasa = await buatJasa(b.pemilik.token);
    const { bookingId } = await buatBookingPublik({ serviceId: jasa.serviceId });
    wajib(await api.patch(`/api/services/${jasa.serviceId}`, { token: b.pemilik.token, json: { isActive: false } }), 200);

    const { booking, workOrder } = await jadikan(b.kasir.token, bookingId);

    expect(workOrder).toMatchObject({ items: [], total: 0, status: 'QUEUED' });
    expect(booking).toMatchObject({ status: 'CONVERTED', service: { serviceId: jasa.serviceId, name: jasa.name } });
    expect(await barisItemSpk(workOrder.number)).toEqual([]);
  });

  it('booking tanpa jasa: SPK tanpa item', async () => {
    const { bookingId } = await buatBookingPublik();

    expect((await jadikan(b.kasir.token, bookingId)).workOrder.items).toEqual([]);
  });
});

describe('pesan WhatsApp work_order_created sesudah konversi', () => {
  it('sesuai templat, ke nomor pelanggan, dengan nama pelanggan tersimpan; dicatat di SPK, bukan di booking', async () => {
    const outlet = await outletSekarang();
    const lama = await buatPelanggan(b.kasir.token, { name: 'Ibu Ratna' });
    const { bookingId, booking } = await buatBookingPublik({ customerName: 'Nama Di Form', phone: variasiHp(lama.phone).lokal, serviceId: b.gantiOli.serviceId });

    const { workOrder } = await jadikan(b.kasir.token, bookingId, { estimatedDoneAt: '2026-11-28T08:00:00.000Z' });

    const harapan = pesanSpkDibuat(outlet, workOrder, tautanLacak(bacaEnv().publicWebUrl, workOrder.trackingToken));
    expect(harapan).toContain('Halo Ibu Ratna,');
    expect(harapan).toContain('Estimasi selesai: 28-11-2026 15:00 WIB');
    expect((await waPalsu.untuk(lama.phone)).map((p) => p.pesan)).toEqual([harapan]);
    const baris = await barisWaSpk(workOrder.number);
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ type: 'work_order_created', phone: lama.phone, body: harapan, status: 'sent', failure_reason: null, booking_id: null });
    expect(await barisWaBooking(booking.number)).toEqual([]);
    expect(workOrder.wa).toMatchObject({ workOrderCreated: { status: 'sent' }, workOrderDone: null, receipt: null });
  });

  it('tanpa estimasi dan motor tanpa tipe: baris estimasi hilang dan kendaraan ditulis "{plat} ({merek})"', async () => {
    const seragam = nomorUnik();
    const { bookingId } = await buatBookingPublik({ customerName: 'Ani', phone: seragam, plate: 'D 1', vehicleBrand: 'Yamaha', vehicleModel: '' });

    const { workOrder } = await jadikan(b.kasir.token, bookingId);

    const harapan = pesanSpkDibuat(await outletSekarang(), workOrder, tautanLacak(bacaEnv().publicWebUrl, workOrder.trackingToken));
    expect(harapan).toContain('Kendaraan: D 1 (Yamaha)');
    expect(harapan).not.toContain('Estimasi selesai');
    expect((await waPalsu.terakhir(seragam)).pesan).toBe(harapan);
  });

  it('gagal kirim tidak menggagalkan konversi: 201, booking CONVERTED, wa.workOrderCreated failed', async () => {
    const seragam = nomorUnik();
    const { bookingId, booking } = await buatBookingPublik({ phone: seragam });
    await waPalsu.gangguan({ gagal: true, nomor: seragam });

    try {
      const { booking: hasil, workOrder } = await jadikan(b.kasir.token, bookingId);

      expect(hasil.status).toBe('CONVERTED');
      expect(workOrder.wa.workOrderCreated).toMatchObject({ status: 'failed' });
      const baris = await barisWaSpk(workOrder.number, 'work_order_created');
      expect(baris.map((w) => w.status)).toEqual(['failed']);
      expect(baris[0]?.failure_reason?.length ?? 0).toBeGreaterThan(0);
      expect((await barisBooking(booking.number)).status).toBe('CONVERTED');
    } finally {
      await waPalsu.gangguan({ gagal: false, nomor: seragam });
    }
  });
});
