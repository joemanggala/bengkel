// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pesan WhatsApp otomatis (whatsapp.md bagian 3): booking dikonfirmasi,
// booking ditolak, SPK dibuat (langsung atau dari booking), dan SPK selesai.
// Tidak ada pesan dari form publik. Pengiriman sesudah commit: gagal kirim
// tidak menggagalkan transaksi dan tetap tercatat di wa_messages.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  aturOutlet,
  bayar,
  buatBookingPublik,
  buatPelanggan,
  buatUlangTautan,
  detailSpk,
  hapusItem,
  isianBooking,
  jadikanSpk,
  konfirmasiBooking,
  siapkanBengkel,
  tambahJasa,
  tolakBooking,
  ubahStatus,
  wajib,
  type Bengkel,
} from '../src/data';
import { barisBooking, barisSpk, barisWaBooking, barisWaSpk, idBooking, idSpk, jumlahBaris } from '../src/db';
import { bacaEnv } from '../src/env';
import { pesanBookingDikonfirmasi, pesanBookingDitolak, pesanSiapDiambil, pesanSpkDibuat } from '../src/format';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { waPalsu } from '../src/wa';
import { nomorLokal, profilOutlet, spkPelangganBaru, tautanSpk } from './pembantu-uang';

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
  await aturOutlet(b.pemilik.token, { name: 'Bengkel Maju Jaya', address: 'Jl. Merdeka No. 10, Bandung', openingHours: 'Senin–Sabtu 08.00–17.00' });
});

afterEach(async () => {
  await waPalsu.gangguan({ gagal: false });
  await waPalsu.jeda(0);
});

const jumlahPesan = async (nomor: string): Promise<number> => (await waPalsu.untuk(nomor)).length;

// Booking (bentuk Booking untuk staf) → isi pesan booking_confirmed.
async function harapanDikonfirmasi(booking: any): Promise<string> {
  return pesanBookingDikonfirmasi(await profilOutlet(), {
    number: booking.number,
    plate: booking.plate,
    visitDate: booking.visitDate,
    serviceName: booking.service?.name ?? null,
  });
}

async function harapanDitolak(booking: any): Promise<string> {
  return pesanBookingDitolak(await profilOutlet(), booking, bacaEnv().publicWebUrl);
}

// Teks bebas ketikan pemesan yang tidak boleh sampai ke nomor di form publik.
const TEKS_PEMESAN = { customerName: 'Pemesan Zulkarnaen', vehicleBrand: 'MerekQwerty', vehicleModel: 'TipeAsdfgh', complaint: 'Keluhan rahasia xyz.' };

describe('tidak ada WhatsApp dari form publik', () => {
  it('membuat booking dan membatalkannya lewat token tidak mengirim pesan apa pun dan tidak mencatat baris wa_messages', async () => {
    const { bookingToken, booking, bookingId } = await buatBookingPublik({ serviceId: b.gantiOli.serviceId });
    const nomor = (await barisBooking(booking.number)).customer_phone;

    harapStatus(await api.post(`/api/public/bookings/${bookingToken}/cancel`), 200);

    expect(await waPalsu.untuk(nomor)).toEqual([]);
    expect(await jumlahBaris('wa_messages', 'booking_id = ?', [bookingId])).toBe(0);
    const staf = wajib(await api.get(`/api/bookings/${bookingId}`, { token: b.kasir.token }), 200).body.data;
    expect(staf.wa).toEqual({ bookingConfirmed: null, bookingRejected: null });
  });

  it('booking yang ditolak karena sudah 3 menunggu juga tidak mengirim pesan', async () => {
    const pertama = await buatBookingPublik();
    const nomor = (await barisBooking(pertama.booking.number)).customer_phone;
    await buatBookingPublik({ phone: nomor });
    await buatBookingPublik({ phone: nomorLokal(nomor) });
    const ditolak = await api.post('/api/public/bookings', { json: await isianBooking({ phone: nomor }) });

    harapGalat(ditolak, 409, 'too_many_pending_bookings');
    expect(await waPalsu.untuk(nomor)).toEqual([]);
  });
});

describe('booking dikonfirmasi → booking_confirmed', () => {
  it('pesan sesuai templat dikirim sekali ke nomor booking, dicatat, dan wa.bookingConfirmed sent', async () => {
    const { bookingId, booking } = await buatBookingPublik({ serviceId: b.gantiOli.serviceId, plate: 'b-1234-xyz' });
    const nomor = (await barisBooking(booking.number)).customer_phone;

    const dikonfirmasi = await konfirmasiBooking(b.kasir.token, bookingId);

    const pesan = await harapanDikonfirmasi(dikonfirmasi);
    expect(pesan).toContain(`Halo, booking servis kamu untuk B 1234 XYZ pada `);
    expect(pesan).toContain(`\n\nJasa: ${b.gantiOli.name}\n\nAlamat: Jl. Merdeka No. 10, Bandung\nJam buka: Senin–Sabtu 08.00–17.00`);
    expect((await waPalsu.untuk(nomor)).map((m) => m.pesan)).toEqual([pesan]);
    expect(dikonfirmasi.wa).toMatchObject({ bookingConfirmed: { status: 'sent' }, bookingRejected: null });
    expect(await barisWaBooking(booking.number)).toMatchObject([
      { type: 'booking_confirmed', phone: nomor, body: pesan, status: 'sent', failure_reason: null, booking_id: bookingId, work_order_id: null },
    ]);
  });

  it('memakai salinan nama jasa saat booking dibuat, bukan nama jasa sesudah diganti', async () => {
    const jasa = wajib(await api.post('/api/services', { token: b.pemilik.token, json: { name: `Servis CVT ${Date.now()}`, price: 60_000 } }), 201).body
      .data;
    const { bookingId, booking } = await buatBookingPublik({ serviceId: jasa.serviceId });
    wajib(await api.patch(`/api/services/${jasa.serviceId}`, { token: b.pemilik.token, json: { name: `${jasa.name} Plus` } }), 200);

    const dikonfirmasi = await konfirmasiBooking(b.kasir.token, bookingId);

    const pesan = (await waPalsu.terakhir((await barisBooking(booking.number)).customer_phone)).pesan;
    expect(pesan).toBe(await harapanDikonfirmasi(dikonfirmasi));
    expect(pesan).toContain(`\nJasa: ${jasa.name}\n`);
    expect(pesan).not.toContain('Plus');
  });

  it('tanpa jasa dan dengan alamat serta jam buka outlet kosong: baris opsional hilang', async () => {
    const asal = await profilOutlet();
    await aturOutlet(b.pemilik.token, { address: '', openingHours: '' });
    try {
      const { bookingId, booking } = await buatBookingPublik();

      const dikonfirmasi = await konfirmasiBooking(b.kasir.token, bookingId);

      const pesan = (await waPalsu.terakhir((await barisBooking(booking.number)).customer_phone)).pesan;
      expect(pesan).toBe(await harapanDikonfirmasi(dikonfirmasi));
      expect(pesan.split('\n')).toHaveLength(4);
      expect(pesan.endsWith('sudah dikonfirmasi.')).toBe(true);
    } finally {
      await aturOutlet(b.pemilik.token, asal);
    }
  });

  it('tidak memuat nama pemesan, merek, tipe, maupun keluhan ketikan pemesan (keputusan 0a-11)', async () => {
    const { bookingId, booking } = await buatBookingPublik(TEKS_PEMESAN);

    await konfirmasiBooking(b.kasir.token, bookingId);

    const pesan = (await waPalsu.terakhir((await barisBooking(booking.number)).customer_phone)).pesan;
    for (const teks of Object.values(TEKS_PEMESAN)) {
      expect(pesan).not.toContain(teks);
    }
  });

  it('konfirmasi kedua (409) tidak mengirim pesan lagi', async () => {
    const { bookingId, booking } = await buatBookingPublik();
    await konfirmasiBooking(b.kasir.token, bookingId);

    expect((await api.post(`/api/bookings/${bookingId}/confirm`, { token: b.kasir.token })).status).toBe(409);

    expect(await barisWaBooking(booking.number)).toHaveLength(1);
    expect(await jumlahPesan((await barisBooking(booking.number)).customer_phone)).toBe(1);
  });
});

describe('booking ditolak → booking_rejected', () => {
  it('dari PENDING: pesan memuat alasan yang sudah dipangkas dan tautan booking ulang; wa.bookingRejected sent', async () => {
    const { bookingId, booking } = await buatBookingPublik(TEKS_PEMESAN);
    const nomor = (await barisBooking(booking.number)).customer_phone;

    const ditolak = await tolakBooking(b.kasir.token, bookingId, '  Bengkel tutup tanggal itu, silakan pilih tanggal lain.\n');

    const pesan = await harapanDitolak(ditolak);
    expect(ditolak.rejectReason).toBe('Bengkel tutup tanggal itu, silakan pilih tanggal lain.');
    expect(pesan).toContain('\n\nAlasan: Bengkel tutup tanggal itu, silakan pilih tanggal lain.\n\n');
    expect(pesan.endsWith(`Silakan booking ulang di ${bacaEnv().publicWebUrl}/booking`)).toBe(true);
    expect((await waPalsu.untuk(nomor)).map((m) => m.pesan)).toEqual([pesan]);
    for (const teks of Object.values(TEKS_PEMESAN)) {
      expect(pesan).not.toContain(teks);
    }
    expect(ditolak.wa).toMatchObject({ bookingConfirmed: null, bookingRejected: { status: 'sent' } });
    expect(await barisWaBooking(booking.number)).toMatchObject([
      { type: 'booking_rejected', phone: nomor, body: pesan, status: 'sent', failure_reason: null, booking_id: bookingId, work_order_id: null },
    ]);
  });

  it('dari CONFIRMED: dua pesan berurutan (dikonfirmasi lalu ditolak), keduanya tercatat', async () => {
    const { bookingId, booking } = await buatBookingPublik();
    const nomor = (await barisBooking(booking.number)).customer_phone;
    await konfirmasiBooking(b.kasir.token, bookingId);

    const ditolak = await tolakBooking(b.pemilik.token, bookingId, 'Mekanik sedang penuh.');

    expect((await waPalsu.untuk(nomor)).map((m) => m.pesan)).toEqual([await harapanDikonfirmasi(ditolak), await harapanDitolak(ditolak)]);
    expect((await barisWaBooking(booking.number)).map((r) => [r.type, r.status])).toEqual([
      ['booking_confirmed', 'sent'],
      ['booking_rejected', 'sent'],
    ]);
    expect(ditolak.wa).toMatchObject({ bookingConfirmed: { status: 'sent' }, bookingRejected: { status: 'sent' } });
  });
});

describe('SPK dibuat → work_order_created', () => {
  it('POST /api/work-orders: pesan sesuai templat dikirim sekali ke nomor pelanggan dan dicatat; wa.workOrderCreated sent', async () => {
    const x = await spkPelangganBaru(b, { ubahSpk: { estimatedDoneAt: '2026-11-28T08:00:00.000Z' } });

    const pesan = pesanSpkDibuat(await profilOutlet(), x.spk, tautanSpk(x.spk));
    expect(pesan).toContain('Estimasi selesai: 28-11-2026 15:00 WIB');
    expect((await waPalsu.untuk(x.nomorHp)).map((m) => m.pesan)).toEqual([pesan]);
    expect(x.spk.wa).toMatchObject({ workOrderCreated: { status: 'sent' }, workOrderDone: null, receipt: null });
    expect(await barisWaSpk(x.spk.number)).toMatchObject([
      { type: 'work_order_created', phone: x.nomorHp, body: pesan, status: 'sent', failure_reason: null, booking_id: null, work_order_id: await idSpk(x.spk.number) },
    ]);
  });

  it('booking dijadikan SPK untuk pelanggan yang sudah ada: pesan memakai nama pelanggan, bukan nama di booking', async () => {
    const pelanggan = await buatPelanggan(b.kasir.token, { name: 'Siti Aminah' });
    const { bookingId, booking } = await buatBookingPublik({ phone: nomorLokal(pelanggan.phone), customerName: 'Nama Di Form' });

    const { workOrder, booking: jadi } = await jadikanSpk(b.kasir.token, bookingId);

    const pesan = pesanSpkDibuat(await profilOutlet(), workOrder, tautanSpk(workOrder));
    expect(pesan).toContain('Halo Siti Aminah, kendaraan kamu');
    expect((await waPalsu.untuk(pelanggan.phone)).map((m) => m.pesan)).toEqual([pesan]);
    expect(workOrder.wa.workOrderCreated.status).toBe('sent');
    expect(jadi.wa).toEqual({ bookingConfirmed: null, bookingRejected: null });
    expect(await barisWaBooking(booking.number)).toEqual([]);
    expect((await barisWaSpk(workOrder.number)).map((r) => [r.type, r.phone])).toEqual([['work_order_created', pelanggan.phone]]);
  });

  it('booking yang sudah dikonfirmasi lalu dijadikan SPK untuk pelanggan baru: dua pesan (booking lalu SPK) dengan nama dari booking', async () => {
    const { bookingId, booking } = await buatBookingPublik({ customerName: 'Rina Wati' });
    const nomor = (await barisBooking(booking.number)).customer_phone;
    await konfirmasiBooking(b.kasir.token, bookingId);

    const { workOrder } = await jadikanSpk(b.kasir.token, bookingId);

    const semua = (await waPalsu.untuk(nomor)).map((m) => m.pesan);
    expect(semua).toHaveLength(2);
    expect(semua[1]).toBe(pesanSpkDibuat(await profilOutlet(), workOrder, tautanSpk(workOrder)));
    expect(semua[1]).toContain('Halo Rina Wati, kendaraan kamu');
  });
});

describe('SPK selesai → work_order_done', () => {
  it('kasir menandai DONE: pesan siap diambil dengan total, uang muka, dan sisa saat itu; wa.workOrderDone sent', async () => {
    const x = await spkPelangganBaru(b, { isi: true });
    await bayar(b.kasir.token, x.spk.number, 50_000);
    await ubahStatus(b.kasir.token, x.spk.number, 'IN_PROGRESS');

    const selesai = await ubahStatus(b.kasir.token, x.spk.number, 'DONE');

    const pesan = pesanSiapDiambil(await profilOutlet(), selesai, tautanSpk(selesai));
    expect(pesan).toContain('Total: Rp90.000\nDibayar: Rp50.000\nSisa: Rp40.000');
    expect((await waPalsu.untuk(x.nomorHp)).map((m) => m.pesan).slice(1)).toEqual([pesan]);
    expect(selesai.wa).toMatchObject({ workOrderCreated: { status: 'sent' }, workOrderDone: { status: 'sent' }, receipt: null });
    expect(await barisWaSpk(x.spk.number, 'work_order_done')).toMatchObject([{ phone: x.nomorHp, body: pesan, status: 'sent', failure_reason: null }]);
  });

  it('mekanik pemilik SPK menandai DONE: pesan yang sama tetap dikirim', async () => {
    const x = await spkPelangganBaru(b, { isi: true, ubahSpk: { mechanicId: b.mekanik.staff.staffId } });
    await ubahStatus(b.mekanik.token, x.spk.number, 'IN_PROGRESS');

    const selesai = await ubahStatus(b.mekanik.token, x.spk.number, 'DONE');

    expect((await waPalsu.terakhir(x.nomorHp)).pesan).toBe(pesanSiapDiambil(await profilOutlet(), selesai, tautanSpk(selesai)));
    expect(selesai.wa.workOrderDone.status).toBe('sent');
  });

  it('perubahan lain tidak mengirim pesan: status selain DONE, item, pembayaran, PATCH, tautan lacak baru, dan pembatalan', async () => {
    const x = await spkPelangganBaru(b, { isi: true });
    const t = b.kasir.token;
    const n = x.spk.number;
    await ubahStatus(t, n, 'IN_PROGRESS');
    await ubahStatus(t, n, 'WAITING_PARTS');
    await ubahStatus(t, n, 'IN_PROGRESS');
    const ditambah = await tambahJasa(t, n, b.cekKelistrikan.serviceId);
    await hapusItem(t, n, ditambah.items.at(-1).itemId);
    wajib(await api.patch(`/api/work-orders/${n}`, { token: t, json: { complaint: 'Rem bunyi.', odometer: 1200 } }), 200);
    await buatUlangTautan(t, n);
    await ubahStatus(t, n, 'DONE');
    await bayar(t, n, 90_000);
    await ubahStatus(t, n, 'PICKED_UP');
    const batal = await spkPelangganBaru(b, { isi: true });
    await ubahStatus(t, batal.spk.number, 'IN_PROGRESS');
    wajib(await api.post(`/api/work-orders/${batal.spk.number}/cancel`, { token: t, json: { reason: 'Pelanggan batal.' } }), 200);

    expect((await barisWaSpk(n)).map((r) => r.type)).toEqual(['work_order_created', 'work_order_done']);
    expect(await jumlahPesan(x.nomorHp)).toBe(2);
    expect((await barisWaSpk(batal.spk.number)).map((r) => r.type)).toEqual(['work_order_created']);
    expect(await jumlahPesan(batal.nomorHp)).toBe(1);
  });
});

describe('gagal kirim tidak menggagalkan transaksi dan tetap tercatat', () => {
  function harapGagal(baris: Array<{ status: string; failure_reason: string | null }>): void {
    expect(baris.map((r) => r.status)).toEqual(['failed']);
    expect(baris[0]?.failure_reason?.length ?? 0).toBeGreaterThan(0);
    expect(JSON.stringify(baris)).not.toContain(bacaEnv().waToken);
  }

  it('konfirmasi booking: 200, status CONFIRMED tersimpan, wa.bookingConfirmed failed, baris failed berisi pesan', async () => {
    const { bookingId, booking } = await buatBookingPublik();
    const nomor = (await barisBooking(booking.number)).customer_phone;
    await waPalsu.gangguan({ gagal: true, nomor, mode: 'putus' });

    const res = await api.post(`/api/bookings/${bookingId}/confirm`, { token: b.kasir.token });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ status: 'CONFIRMED', wa: { bookingConfirmed: { status: 'failed' }, bookingRejected: null } });
    expect((await barisBooking(booking.number)).status).toBe('CONFIRMED');
    const baris = await barisWaBooking(booking.number, 'booking_confirmed');
    harapGagal(baris);
    expect(baris[0]).toMatchObject({ phone: nomor, body: await harapanDikonfirmasi(res.body.data) });
  });

  it('tolak booking: 200, status REJECTED tersimpan, wa.bookingRejected failed', async () => {
    const { bookingId, booking } = await buatBookingPublik();
    await waPalsu.gangguan({ gagal: true, nomor: (await barisBooking(booking.number)).customer_phone, mode: 'gema-token' });

    const res = await api.post(`/api/bookings/${bookingId}/reject`, { token: b.kasir.token, json: { reason: 'Tutup.' } });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ status: 'REJECTED', rejectReason: 'Tutup.', wa: { bookingRejected: { status: 'failed' } } });
    expect(res.teks).not.toContain(bacaEnv().waToken);
    harapGagal(await barisWaBooking(booking.number, 'booking_rejected'));
  });

  it('membuat SPK: 201 dengan wa.workOrderCreated failed, SPK tersimpan dan tautan lacaknya berfungsi; kirim ulang sesudahnya berhasil', async () => {
    const pelanggan = await buatPelanggan(b.kasir.token);
    const kendaraan = wajib(
      await api.post(`/api/customers/${pelanggan.customerId}/vehicles`, { token: b.kasir.token, json: { type: 'CAR', plate: 'D 77 ZZ', brand: 'Toyota' } }),
      201,
    ).body.data;
    await waPalsu.gangguan({ gagal: true, nomor: pelanggan.phone, mode: 'http-500' });

    const res = await api.post('/api/work-orders', { token: b.kasir.token, json: { vehicleId: kendaraan.vehicleId, complaint: 'Mesin mati.' } });

    harapStatus(res, 201);
    expect(res.body.data.wa.workOrderCreated.status).toBe('failed');
    expect((await barisSpk(res.body.data.number)).status).toBe('QUEUED');
    harapStatus(await api.get(`/api/public/work-orders/${res.body.data.trackingToken}`), 200);
    const baris = await barisWaSpk(res.body.data.number, 'work_order_created');
    harapGagal(baris);
    expect(baris[0]?.body).toBe(pesanSpkDibuat(await profilOutlet(), res.body.data, tautanSpk(res.body.data)));

    await waPalsu.gangguan({ gagal: false });
    const ulang = await api.post(`/api/work-orders/${res.body.data.number}/wa`, { token: b.kasir.token, json: { type: 'work_order_created' } });
    harapStatus(ulang, 200);
    expect(ulang.body.data.wa.workOrderCreated.status).toBe('sent');
  });

  it('menjadikan booking SPK: 201, booking CONVERTED dan SPK tersimpan, wa.workOrderCreated failed', async () => {
    const { bookingId, booking } = await buatBookingPublik();
    await waPalsu.gangguan({ gagal: true, nomor: (await barisBooking(booking.number)).customer_phone });

    const res = await api.post(`/api/bookings/${bookingId}/convert`, { token: b.kasir.token, json: {} });

    harapStatus(res, 201);
    expect(res.body.data.booking.status).toBe('CONVERTED');
    expect(res.body.data.workOrder.wa.workOrderCreated.status).toBe('failed');
    expect((await barisBooking(booking.number)).work_order_id).toBe(await idSpk(res.body.data.workOrder.number));
    harapGagal(await barisWaSpk(res.body.data.workOrder.number, 'work_order_created'));
    expect(await jumlahBaris('wa_messages', 'booking_id = ?', [await idBooking(booking.number)])).toBe(0);
  });

  it('menandai DONE: 200, status DONE tersimpan, wa.workOrderDone failed di balasan dan di rincian', async () => {
    const x = await spkPelangganBaru(b, { isi: true });
    await ubahStatus(b.kasir.token, x.spk.number, 'IN_PROGRESS');
    await waPalsu.gangguan({ gagal: true, nomor: x.nomorHp });

    const res = await api.post(`/api/work-orders/${x.spk.number}/status`, { token: b.kasir.token, json: { status: 'DONE' } });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ status: 'DONE', wa: { workOrderCreated: { status: 'sent' }, workOrderDone: { status: 'failed' } } });
    expect((await barisSpk(x.spk.number)).status).toBe('DONE');
    harapGagal(await barisWaSpk(x.spk.number, 'work_order_done'));
    expect((await detailSpk(b.kasir.token, x.spk.number)).wa.workOrderDone.status).toBe('failed');
  });
});

describe('penyedia WhatsApp dipanggil sesudah commit', () => {
  it('selagi pesan SPK pertama ditahan penyedia, SPK kedua tetap dibuat lebih dulu dengan nomor sesudahnya (kunci penghitung sudah dilepas)', async () => {
    const satu = await buatPelanggan(b.kasir.token);
    const kendaraanSatu = wajib(
      await api.post(`/api/customers/${satu.customerId}/vehicles`, { token: b.kasir.token, json: { type: 'MOTOR', plate: 'F 4321 AB', brand: 'Honda' } }),
      201,
    ).body.data;
    const dua = await spkPelangganBaru(b);
    await waPalsu.jeda(2500, satu.phone);
    let pertamaSelesai = false;
    const pertama = api.post('/api/work-orders', { token: b.kasir.token, json: { vehicleId: kendaraanSatu.vehicleId, complaint: 'Servis.' } }).then((r) => {
      pertamaSelesai = true;
      return r;
    });
    await waPalsu.tungguDikirim(satu.phone);

    const kedua = await api.post('/api/work-orders', { token: b.pemilik.token, json: { vehicleId: dua.kendaraan.vehicleId, complaint: 'Servis.' } });
    const sudahSelesai = pertamaSelesai;

    harapStatus(kedua, 201);
    expect(sudahSelesai, 'SPK kedua menunggu pesan SPK pertama: penyedia dipanggil di dalam transaksi?').toBe(false);
    const hasilPertama = await pertama;
    harapStatus(hasilPertama, 201);
    const urut = (n: string): number => Number(n.slice(2));
    expect(urut(kedua.body.data.number)).toBe(urut(hasilPertama.body.data.number) + 1);
    expect(hasilPertama.body.data.wa.workOrderCreated.status).toBe('sent');
  });
});
