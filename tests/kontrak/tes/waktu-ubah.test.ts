// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Kapan `updatedAt` berubah (bagian "Waktu" deskripsi API): PATCH tanpa field
// yang dikenal tidak menulis apa pun; tautan lacak baru memperbarui SPK,
// pengiriman WhatsApp tidak; setiap perubahan status booking memperbaruinya.
// `updated_at` dimundurkan langsung di database lebih dulu, jadi "berubah"
// dan "tetap" dinilai tanpa bergantung pada selisih milidetik.

import { beforeAll, describe, expect, it } from 'vitest';
import {
  buatBookingPublik,
  buatJasa,
  buatPart,
  buatPelanggan,
  bookingStaf,
  buatSpk,
  buatUlangTautan,
  detailSpk,
  jadikanSpk,
  kirimWa,
  konfirmasiBooking,
  siapkanBengkel,
  tambahKendaraan,
  tolakBooking,
  type Bengkel,
} from '../src/data';
import { jalankan } from '../src/db';
import { harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { batalkanBookingPublik } from './pembantu-booking';
import { WAKTU_LAMA } from './pembantu-spk';

const WAKTU_LAMA_DB = '2001-01-01 00:00:00.000';

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
});

async function mundurkan(tabel: string, kolomId: string, id: string): Promise<void> {
  const jumlah = await jalankan(`UPDATE ${tabel} SET updated_at = ? WHERE ${kolomId} = ?`, [WAKTU_LAMA_DB, id]);
  if (jumlah !== 1) {
    throw new Error(`Baris ${tabel} ${id} tidak ditemukan untuk dimundurkan updated_at-nya`);
  }
}

const tetap = (teks: string): boolean => Date.parse(teks) === Date.parse(WAKTU_LAMA);
const berubah = (teks: string): boolean => Date.parse(teks) > Date.parse(WAKTU_LAMA);

interface Sumber {
  nama: string;
  // Membuat satu sumber baru, memundurkan updated_at-nya, lalu membalas fungsi PATCH-nya.
  siapkan: () => Promise<(json: Record<string, unknown>) => Promise<Respons>>;
  // Satu field yang dikenal dengan nilai baru.
  ubah: () => Record<string, unknown>;
}

let urutan = 0;
const SUMBER: Sumber[] = [
  {
    nama: 'pelanggan',
    siapkan: async () => {
      const p = await buatPelanggan(b.kasir.token);
      await mundurkan('customers', 'customer_id', p.customerId);
      return (json) => api.patch(`/api/customers/${p.customerId}`, { token: b.kasir.token, json });
    },
    ubah: () => ({ notes: `Catatan ${++urutan}` }),
  },
  {
    nama: 'kendaraan',
    siapkan: async () => {
      const v = await tambahKendaraan(b.kasir.token, b.pelanggan.customerId);
      await mundurkan('vehicles', 'vehicle_id', v.vehicleId);
      return (json) => api.patch(`/api/vehicles/${v.vehicleId}`, { token: b.kasir.token, json });
    },
    ubah: () => ({ color: `Warna ${++urutan}` }),
  },
  {
    nama: 'jasa',
    siapkan: async () => {
      const j = await buatJasa(b.pemilik.token);
      await mundurkan('services', 'service_id', j.serviceId);
      return (json) => api.patch(`/api/services/${j.serviceId}`, { token: b.pemilik.token, json });
    },
    ubah: () => ({ price: 40_000 + ++urutan }),
  },
  {
    nama: 'sparepart',
    siapkan: async () => {
      const s = await buatPart(b.pemilik.token);
      await mundurkan('parts', 'part_id', s.partId);
      return (json) => api.patch(`/api/parts/${s.partId}`, { token: b.pemilik.token, json });
    },
    ubah: () => ({ minStock: ++urutan }),
  },
  {
    nama: 'SPK',
    siapkan: async () => {
      const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);
      await mundurkan('work_orders', 'number', spk.number);
      return (json) => api.patch(`/api/work-orders/${spk.number}`, { token: b.kasir.token, json });
    },
    ubah: () => ({ diagnosis: `Diagnosis ${++urutan}` }),
  },
];

describe('PATCH tanpa field yang dikenal tidak mengubah updatedAt', () => {
  it.each(SUMBER.map((s) => [s.nama, s] as const))('%s: {} dan badan berisi field tak dikenal saja → 200, updatedAt tetap', async (_nama, sumber) => {
    const patch = await sumber.siapkan();

    for (const json of [{}, { lain: 'diabaikan', updatedAt: '2030-01-01T00:00:00Z' }]) {
      const res = await patch(json);
      harapStatus(res, 200);
      expect(tetap(res.body.data.updatedAt), `${JSON.stringify(json)} → ${res.body.data.updatedAt}`).toBe(true);
    }
  });

  it.each(SUMBER.map((s) => [s.nama, s] as const))('%s: PATCH dengan field yang dikenal bernilai baru memperbarui updatedAt', async (_nama, sumber) => {
    const patch = await sumber.siapkan();

    const res = await patch(sumber.ubah());

    harapStatus(res, 200);
    expect(berubah(res.body.data.updatedAt)).toBe(true);
  });
});

describe('updatedAt SPK: tautan lacak dan WhatsApp', () => {
  it('membuat ulang tautan lacak memperbarui updatedAt SPK', async () => {
    const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);
    await mundurkan('work_orders', 'number', spk.number);

    const baru = await buatUlangTautan(b.kasir.token, spk.number);

    expect(baru.trackingToken).not.toBe(spk.trackingToken);
    expect(berubah(baru.updatedAt)).toBe(true);
  });

  it('kirim ulang WhatsApp (berhasil) tidak mengubah updatedAt SPK, walau ringkasan wa berubah', async () => {
    const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);
    await mundurkan('work_orders', 'number', spk.number);

    const sesudah = await kirimWa(b.kasir.token, spk.number, 'receipt');

    expect(sesudah.wa.receipt.status).toBe('sent');
    expect(tetap(sesudah.updatedAt)).toBe(true);
    expect(tetap((await detailSpk(b.kasir.token, spk.number)).updatedAt)).toBe(true);
  });
});

describe('updatedAt booking berubah setiap statusnya berubah', () => {
  async function bookingTua(): Promise<{ bookingId: string; bookingToken: string }> {
    const { bookingId, bookingToken } = await buatBookingPublik();
    await mundurkan('bookings', 'booking_id', bookingId);
    expect(tetap((await bookingStaf(b.kasir.token, bookingId)).updatedAt)).toBe(true);
    return { bookingId, bookingToken };
  }

  it('konfirmasi, lalu tolak dari CONFIRMED: masing-masing memperbarui updatedAt', async () => {
    const { bookingId } = await bookingTua();
    expect(berubah((await konfirmasiBooking(b.kasir.token, bookingId)).updatedAt)).toBe(true);

    await mundurkan('bookings', 'booking_id', bookingId);
    expect(berubah((await tolakBooking(b.kasir.token, bookingId)).updatedAt)).toBe(true);
  });

  it('jadi SPK memperbarui updatedAt booking', async () => {
    const { bookingId } = await bookingTua();

    const { booking } = await jadikanSpk(b.kasir.token, bookingId);

    expect(berubah(booking.updatedAt)).toBe(true);
  });

  it('dibatalkan pelanggan memperbarui updatedAt booking (dibaca staf)', async () => {
    const { bookingId, bookingToken } = await bookingTua();

    harapStatus(await batalkanBookingPublik(bookingToken), 200);

    const booking = await bookingStaf(b.kasir.token, bookingId);
    expect(booking.status).toBe('CANCELLED');
    expect(berubah(booking.updatedAt)).toBe(true);
  });
});
