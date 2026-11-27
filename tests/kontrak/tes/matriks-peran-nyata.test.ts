// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { beforeAll, describe, expect, it } from 'vitest';
import {
  buatBookingPublik,
  buatMekanik,
  buatPart,
  buatSpk,
  emailUnik,
  masukStaf,
  namaUnik,
  nomorUnik,
  platUnik,
  SANDI_UJI,
  siapkanBengkel,
  skuUnik,
  tambahJasa,
  ubahStatus,
  type Bengkel,
  type SesiStaf,
} from '../src/data';
import { baca, barisSpk } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { operasiSpec, profilOutlet } from './pembantu-uang';

// Bagian kedua matriks izin (lihat matriks-peran.test.ts): setiap operasi staf
// dipanggil dengan data sungguhan oleh ketiga peran. Yang berhak sukses, yang
// tidak berhak 403 tanpa efek samping. Ditambah batas mekanik: hanya SPK yang
// ditugaskan kepadanya.

type Peran = 'owner' | 'cashier' | 'mechanic';
type Izin = 'semua' | 'kasir' | 'pemilik';
const BOLEH: Record<Izin, Peran[]> = { semua: ['owner', 'cashier', 'mechanic'], kasir: ['owner', 'cashier'], pemilik: ['owner'] };

let b: Bengkel;
let mekanikLain: SesiStaf;

const sesi = (p: Peran): SesiStaf => ({ owner: b.pemilik, cashier: b.kasir, mechanic: b.mekanik })[p];

// SPK segar yang ditugaskan ke mekanik bengkel, dibuat kasir, supaya
// pemanggilan satu peran tidak memengaruhi peran lain.
const spkMekanik = () => buatSpk(b.kasir.token, b.kendaraan.vehicleId, { mechanicId: b.mekanik.staff.staffId });
const spkMekanikBerisi = async () => tambahJasa(b.kasir.token, (await spkMekanik()).number, b.gantiOli.serviceId);

interface Nyata {
  nama: string;
  izin: Izin;
  status: number;
  panggil: (token: string, peran: Peran) => Promise<Respons>;
}

const NYATA: Nyata[] = [
  { nama: 'GET /api/staff/me', izin: 'semua', status: 200, panggil: (t) => api.get('/api/staff/me', { token: t }) },
  // Sesi segar, supaya token utama peran itu tetap hidup.
  { nama: 'POST /api/staff/logout', izin: 'semua', status: 204, panggil: async (_t, p) => api.post('/api/staff/logout', { token: (await masukStaf(sesi(p).staff.email)).token }) },
  { nama: 'GET /api/staff', izin: 'pemilik', status: 200, panggil: (t) => api.get('/api/staff', { token: t }) },
  {
    nama: 'POST /api/staff',
    izin: 'pemilik',
    status: 201,
    panggil: (t) => api.post('/api/staff', { token: t, json: { name: 'Staf Baru', email: emailUnik('baru'), password: SANDI_UJI, role: 'cashier' } }),
  },
  { nama: 'PATCH /api/staff/{staffId}', izin: 'pemilik', status: 200, panggil: (t) => api.patch(`/api/staff/${b.kasir.staff.staffId}`, { token: t, json: {} }) },
  { nama: 'GET /api/mechanics', izin: 'kasir', status: 200, panggil: (t) => api.get('/api/mechanics', { token: t }) },
  { nama: 'PUT /api/outlet', izin: 'pemilik', status: 200, panggil: async (t) => api.put('/api/outlet', { token: t, json: await profilOutlet() }) },
  { nama: 'GET /api/customers', izin: 'kasir', status: 200, panggil: (t) => api.get('/api/customers', { token: t }) },
  { nama: 'POST /api/customers', izin: 'kasir', status: 201, panggil: (t) => api.post('/api/customers', { token: t, json: { name: 'Pelanggan Baru', phone: nomorUnik() } }) },
  { nama: 'GET /api/customers/{customerId}', izin: 'kasir', status: 200, panggil: (t) => api.get(`/api/customers/${b.pelanggan.customerId}`, { token: t }) },
  { nama: 'PATCH /api/customers/{customerId}', izin: 'kasir', status: 200, panggil: (t) => api.patch(`/api/customers/${b.pelanggan.customerId}`, { token: t, json: {} }) },
  {
    nama: 'POST /api/customers/{customerId}/vehicles',
    izin: 'kasir',
    status: 201,
    panggil: (t) => api.post(`/api/customers/${b.pelanggan.customerId}/vehicles`, { token: t, json: { type: 'MOTOR', plate: platUnik(), brand: 'Honda' } }),
  },
  { nama: 'GET /api/vehicles', izin: 'kasir', status: 200, panggil: (t) => api.get('/api/vehicles', { token: t, query: { plate: 'B' } }) },
  { nama: 'PATCH /api/vehicles/{vehicleId}', izin: 'kasir', status: 200, panggil: (t) => api.patch(`/api/vehicles/${b.kendaraan.vehicleId}`, { token: t, json: {} }) },
  { nama: 'GET /api/vehicles/{vehicleId}/work-orders', izin: 'kasir', status: 200, panggil: (t) => api.get(`/api/vehicles/${b.kendaraan.vehicleId}/work-orders`, { token: t }) },
  { nama: 'GET /api/services', izin: 'semua', status: 200, panggil: (t) => api.get('/api/services', { token: t }) },
  { nama: 'POST /api/services', izin: 'pemilik', status: 201, panggil: (t) => api.post('/api/services', { token: t, json: { name: namaUnik('Jasa'), price: 20_000 } }) },
  { nama: 'PATCH /api/services/{serviceId}', izin: 'pemilik', status: 200, panggil: (t) => api.patch(`/api/services/${b.gantiOli.serviceId}`, { token: t, json: {} }) },
  { nama: 'GET /api/parts', izin: 'semua', status: 200, panggil: (t) => api.get('/api/parts', { token: t }) },
  {
    nama: 'POST /api/parts',
    izin: 'pemilik',
    status: 201,
    panggil: (t) => api.post('/api/parts', { token: t, json: { sku: skuUnik(), name: namaUnik('Part'), unit: 'pcs', price: 10_000, costPrice: 5000, initialStock: 0, minStock: 0 } }),
  },
  { nama: 'PATCH /api/parts/{partId}', izin: 'pemilik', status: 200, panggil: (t) => api.patch(`/api/parts/${b.kampas.partId}`, { token: t, json: {} }) },
  { nama: 'GET /api/parts/{partId}/movements', izin: 'pemilik', status: 200, panggil: (t) => api.get(`/api/parts/${b.kampas.partId}/movements`, { token: t }) },
  { nama: 'POST /api/parts/{partId}/stock-in', izin: 'pemilik', status: 200, panggil: (t) => api.post(`/api/parts/${b.kampas.partId}/stock-in`, { token: t, json: { quantity: 1 } }) },
  {
    nama: 'POST /api/parts/{partId}/stock-out',
    izin: 'pemilik',
    status: 200,
    panggil: (t) => api.post(`/api/parts/${b.kampas.partId}/stock-out`, { token: t, json: { quantity: 1, note: 'Rusak' } }),
  },
  {
    nama: 'POST /api/parts/{partId}/stock-count',
    izin: 'pemilik',
    status: 200,
    panggil: (t) => api.post(`/api/parts/${b.kampas.partId}/stock-count`, { token: t, json: { countedStock: 10, note: 'Opname' } }),
  },
  { nama: 'GET /api/bookings', izin: 'kasir', status: 200, panggil: (t) => api.get('/api/bookings', { token: t }) },
  { nama: 'GET /api/bookings/{bookingId}', izin: 'kasir', status: 200, panggil: async (t) => api.get(`/api/bookings/${(await buatBookingPublik()).bookingId}`, { token: t }) },
  { nama: 'POST /api/bookings/{bookingId}/confirm', izin: 'kasir', status: 200, panggil: async (t) => api.post(`/api/bookings/${(await buatBookingPublik()).bookingId}/confirm`, { token: t }) },
  {
    nama: 'POST /api/bookings/{bookingId}/reject',
    izin: 'kasir',
    status: 200,
    panggil: async (t) => api.post(`/api/bookings/${(await buatBookingPublik()).bookingId}/reject`, { token: t, json: { reason: 'Bengkel tutup.' } }),
  },
  { nama: 'POST /api/bookings/{bookingId}/convert', izin: 'kasir', status: 201, panggil: async (t) => api.post(`/api/bookings/${(await buatBookingPublik()).bookingId}/convert`, { token: t, json: {} }) },
  { nama: 'GET /api/work-orders', izin: 'semua', status: 200, panggil: (t) => api.get('/api/work-orders', { token: t }) },
  { nama: 'POST /api/work-orders', izin: 'kasir', status: 201, panggil: (t) => api.post('/api/work-orders', { token: t, json: { vehicleId: b.kendaraan.vehicleId, complaint: 'Servis.' } }) },
  { nama: 'GET /api/work-orders/{number}', izin: 'semua', status: 200, panggil: async (t) => api.get(`/api/work-orders/${(await spkMekanik()).number}`, { token: t }) },
  {
    nama: 'PATCH /api/work-orders/{number}',
    izin: 'semua',
    status: 200,
    panggil: async (t) => api.patch(`/api/work-orders/${(await spkMekanik()).number}`, { token: t, json: { diagnosis: 'Kampas tipis.' } }),
  },
  {
    nama: 'POST /api/work-orders/{number}/status',
    izin: 'semua',
    status: 200,
    panggil: async (t) => api.post(`/api/work-orders/${(await spkMekanik()).number}/status`, { token: t, json: { status: 'IN_PROGRESS' } }),
  },
  {
    nama: 'POST /api/work-orders/{number}/cancel',
    izin: 'kasir',
    status: 200,
    panggil: async (t) => api.post(`/api/work-orders/${(await spkMekanik()).number}/cancel`, { token: t, json: { reason: 'Batal saja.' } }),
  },
  {
    nama: 'POST /api/work-orders/{number}/items',
    izin: 'kasir',
    status: 201,
    panggil: async (t) =>
      api.post(`/api/work-orders/${(await spkMekanik()).number}/items`, { token: t, json: { type: 'SERVICE', serviceId: b.gantiOli.serviceId, quantity: 1 } }),
  },
  {
    nama: 'DELETE /api/work-orders/{number}/items/{itemId}',
    izin: 'kasir',
    status: 200,
    panggil: async (t) => {
      const spk = await spkMekanikBerisi();
      return api.delete(`/api/work-orders/${spk.number}/items/${spk.items[0].itemId}`, { token: t });
    },
  },
  {
    nama: 'POST /api/work-orders/{number}/payments',
    izin: 'kasir',
    status: 201,
    panggil: async (t) => api.post(`/api/work-orders/${(await spkMekanikBerisi()).number}/payments`, { token: t, json: { amount: 1000, method: 'cash' } }),
  },
  { nama: 'POST /api/work-orders/{number}/wa', izin: 'kasir', status: 200, panggil: async (t) => api.post(`/api/work-orders/${(await spkMekanik()).number}/wa`, { token: t, json: { type: 'receipt' } }) },
  { nama: 'POST /api/work-orders/{number}/tracking-link', izin: 'kasir', status: 200, panggil: async (t) => api.post(`/api/work-orders/${(await spkMekanik()).number}/tracking-link`, { token: t }) },
  { nama: 'GET /api/reports/daily', izin: 'pemilik', status: 200, panggil: (t) => api.get('/api/reports/daily', { token: t, query: { date: '2026-01-15' } }) },
];

const KASUS = NYATA.flatMap((r) => (['owner', 'cashier', 'mechanic'] as const).map((peran) => ({ r, peran, judul: `${peran} → ${r.nama}` })));

beforeAll(async () => {
  b = await siapkanBengkel();
  mekanikLain = await buatMekanik({ name: 'Mekanik Lain' });
});

describe('data nyata: yang berhak sukses, yang tidak berhak 403', () => {
  it('tabel ini memuat semua 42 operasi staf di spec', () => {
    expect(NYATA.map((r) => r.nama).sort()).toEqual(operasiSpec().staf);
  });

  it.each(KASUS)('$judul', async ({ r, peran }) => {
    const res = await r.panggil(sesi(peran).token, peran);

    if (BOLEH[r.izin].includes(peran)) {
      harapStatus(res, r.status);
    } else {
      harapGalat(res, 403, 'forbidden');
    }
  });
});

// Potret data yang bisa diubah rute-rute di atas, langsung dari database.
async function potret(): Promise<unknown> {
  const satu = async (sql: string) => baca(sql);
  return {
    staf: await satu('SELECT staff_id, name, email, role, is_active FROM staff ORDER BY staff_id'),
    outlet: await satu('SELECT * FROM outlet'),
    pelanggan: await satu('SELECT customer_id, name, phone, address, notes FROM customers ORDER BY customer_id'),
    kendaraan: await satu('SELECT vehicle_id, plate_key, brand FROM vehicles ORDER BY vehicle_id'),
    jasa: await satu('SELECT service_id, name, price, is_active FROM services ORDER BY service_id'),
    part: await satu('SELECT part_id, sku, price, cost_price, stock, is_active FROM parts ORDER BY part_id'),
    kartu: await satu('SELECT COUNT(*) AS n FROM stock_movements'),
    booking: await satu('SELECT booking_id, status, work_order_id FROM bookings ORDER BY booking_id'),
    spk: await satu('SELECT work_order_id, status, mechanic_staff_id, diagnosis, total, paid_amount, tracking_token FROM work_orders ORDER BY work_order_id'),
    item: await satu('SELECT COUNT(*) AS n FROM work_order_items'),
    log: await satu('SELECT COUNT(*) AS n FROM work_order_status_logs'),
    bayar: await satu('SELECT COUNT(*) AS n FROM payments'),
    wa: await satu('SELECT COUNT(*) AS n FROM wa_messages'),
  };
}

describe('yang tidak berhak ditolak tanpa efek samping', () => {
  it('kasir dan mekanik memanggil semua rute khusus pemilik, mekanik memanggil semua rute khusus kasir pada data yang sudah ada: database tidak berubah', async () => {
    const spk = await spkMekanikBerisi();
    const { bookingId } = await buatBookingPublik();
    const n = spk.number;
    const khususKasir: Array<(t: string) => Promise<Respons>> = [
      (t) => api.post('/api/customers', { token: t, json: { name: 'Pelanggan Baru', phone: nomorUnik() } }),
      (t) => api.patch(`/api/customers/${b.pelanggan.customerId}`, { token: t, json: { name: 'Ganti Nama' } }),
      (t) => api.post(`/api/customers/${b.pelanggan.customerId}/vehicles`, { token: t, json: { type: 'MOTOR', plate: platUnik(), brand: 'Honda' } }),
      (t) => api.patch(`/api/vehicles/${b.kendaraan.vehicleId}`, { token: t, json: { brand: 'Suzuki' } }),
      (t) => api.post(`/api/bookings/${bookingId}/confirm`, { token: t }),
      (t) => api.post(`/api/bookings/${bookingId}/reject`, { token: t, json: { reason: 'Bengkel tutup.' } }),
      (t) => api.post(`/api/bookings/${bookingId}/convert`, { token: t, json: {} }),
      (t) => api.post('/api/work-orders', { token: t, json: { vehicleId: b.kendaraan.vehicleId, complaint: 'Servis.' } }),
      (t) => api.post(`/api/work-orders/${n}/cancel`, { token: t, json: { reason: 'Batal saja.' } }),
      (t) => api.post(`/api/work-orders/${n}/items`, { token: t, json: { type: 'PART', partId: b.oli.partId, quantity: 1 } }),
      (t) => api.delete(`/api/work-orders/${n}/items/${spk.items[0].itemId}`, { token: t }),
      (t) => api.post(`/api/work-orders/${n}/payments`, { token: t, json: { amount: 1000, method: 'cash' } }),
      (t) => api.post(`/api/work-orders/${n}/wa`, { token: t, json: { type: 'receipt' } }),
      (t) => api.post(`/api/work-orders/${n}/tracking-link`, { token: t }),
    ];
    const khususPemilik: Array<(t: string) => Promise<Respons>> = [
      (t) => api.post('/api/staff', { token: t, json: { name: 'Staf Baru', email: emailUnik('baru'), password: SANDI_UJI, role: 'owner' } }),
      (t) => api.patch(`/api/staff/${t === b.kasir.token ? b.kasir.staff.staffId : b.mekanik.staff.staffId}`, { token: t, json: { role: 'owner' } }),
      async (t) => api.put('/api/outlet', { token: t, json: { ...(await profilOutlet()), name: 'Bengkel Liar' } }),
      (t) => api.post('/api/services', { token: t, json: { name: namaUnik('Jasa'), price: 1 } }),
      (t) => api.patch(`/api/services/${b.gantiOli.serviceId}`, { token: t, json: { price: 1 } }),
      (t) => api.post('/api/parts', { token: t, json: { sku: skuUnik(), name: namaUnik('Part'), unit: 'pcs', price: 1, costPrice: 1, initialStock: 5, minStock: 0 } }),
      (t) => api.patch(`/api/parts/${b.oli.partId}`, { token: t, json: { price: 1, costPrice: 1 } }),
      (t) => api.post(`/api/parts/${b.oli.partId}/stock-in`, { token: t, json: { quantity: 5 } }),
      (t) => api.post(`/api/parts/${b.oli.partId}/stock-out`, { token: t, json: { quantity: 1, note: 'Rusak' } }),
      (t) => api.post(`/api/parts/${b.oli.partId}/stock-count`, { token: t, json: { countedStock: 0, note: 'Opname' } }),
    ];
    const sebelum = await potret();

    for (const panggil of khususKasir) {
      harapGalat(await panggil(b.mekanik.token), 403, 'forbidden');
    }
    for (const t of [b.kasir.token, b.mekanik.token]) {
      for (const panggil of khususPemilik) {
        harapGalat(await panggil(t), 403, 'forbidden');
      }
    }

    expect(await potret()).toEqual(sebelum);
  });
});

describe('batas mekanik: hanya SPK yang ditugaskan kepadanya', () => {
  it('daftar SPK mekanik otomatis tersaring; mechanicId mekanik lain di query diabaikan untuknya', async () => {
    const milik = await spkMekanik();
    const lain = await buatSpk(b.kasir.token, b.kendaraan.vehicleId, { mechanicId: mekanikLain.staff.staffId });
    const tanpa = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);

    const semua = async (query: Record<string, string>) => {
      const res = await api.get('/api/work-orders', { token: b.mekanik.token, query: { limit: '50', ...query } });
      harapStatus(res, 200);
      return res.body.data.map((s: any) => s.number) as string[];
    };

    for (const daftar of [await semua({}), await semua({ mechanicId: mekanikLain.staff.staffId })]) {
      expect(daftar).toContain(milik.number);
      expect(daftar).not.toContain(lain.number);
      expect(daftar).not.toContain(tanpa.number);
    }
    const kasir = wajibDaftar(await api.get('/api/work-orders', { token: b.kasir.token, query: { limit: '50' } }));
    expect(kasir).toEqual(expect.arrayContaining([milik.number, lain.number, tanpa.number]));
  });

  it.each<[string, () => Promise<any>]>([
    ['mekanik lain', () => buatSpk(b.kasir.token, b.kendaraan.vehicleId, { mechanicId: mekanikLain.staff.staffId })],
    ['tanpa mekanik', () => buatSpk(b.kasir.token, b.kendaraan.vehicleId)],
  ])('SPK %s: rincian, PATCH, dan status → 403 (sesudah 404), tanpa perubahan', async (_nama, buat) => {
    const spk = await buat();

    harapGalat(await api.get(`/api/work-orders/${spk.number}`, { token: b.mekanik.token }), 403, 'forbidden');
    harapGalat(await api.patch(`/api/work-orders/${spk.number}`, { token: b.mekanik.token, json: { diagnosis: 'Coba.' } }), 403, 'forbidden');
    harapGalat(await api.post(`/api/work-orders/${spk.number}/status`, { token: b.mekanik.token, json: { status: 'IN_PROGRESS' } }), 403, 'forbidden');
    harapGalat(await api.post(`/api/work-orders/${spk.number}/status`, { token: b.mekanik.token, json: { status: 'x' } }), 403, 'forbidden');
    harapGalat(await api.get('/api/work-orders/S-9999', { token: b.mekanik.token }), 404, 'not_found');
    expect(await barisSpk(spk.number)).toMatchObject({ status: 'QUEUED', diagnosis: '' });
  });

  it('di PATCH mekanik hanya boleh diagnosis: kunci lain (apa pun nilainya, termasuk null) → 403; {} → 200', async () => {
    const spk = await spkMekanik();

    for (const json of [{ complaint: 'Ganti.' }, { mechanicId: null }, { odometer: null, diagnosis: 'x' }, { estimatedDoneAt: null }]) {
      harapGalat(await api.patch(`/api/work-orders/${spk.number}`, { token: b.mekanik.token, json }), 403, 'forbidden');
    }
    harapStatus(await api.patch(`/api/work-orders/${spk.number}`, { token: b.mekanik.token, json: {} }), 200);
    const res = await api.patch(`/api/work-orders/${spk.number}`, { token: b.mekanik.token, json: { diagnosis: 'Kampas habis.' } });
    harapStatus(res, 200);
    expect(res.body.data.diagnosis).toBe('Kampas habis.');
  });

  it('di status mekanik boleh IN_PROGRESS, WAITING_PARTS, DONE; PICKED_UP → 403 (sesudah 422)', async () => {
    const spk = await spkMekanikBerisi();
    const n = spk.number;

    await ubahStatus(b.mekanik.token, n, 'IN_PROGRESS');
    await ubahStatus(b.mekanik.token, n, 'WAITING_PARTS');
    await ubahStatus(b.mekanik.token, n, 'IN_PROGRESS');
    const selesai = await ubahStatus(b.mekanik.token, n, 'DONE');
    expect(selesai.status).toBe('DONE');

    harapGalat(await api.post(`/api/work-orders/${n}/status`, { token: b.mekanik.token, json: { status: 'QUEUED' } }), 422, 'validation_failed', { status: 'invalid_format' });
    harapGalat(await api.post(`/api/work-orders/${n}/status`, { token: b.mekanik.token, json: { status: 'PICKED_UP' } }), 403, 'forbidden');
    expect((await barisSpk(n)).status).toBe('DONE');
  });
});

function wajibDaftar(res: Respons): string[] {
  harapStatus(res, 200);
  return res.body.data.map((s: any) => s.number);
}
