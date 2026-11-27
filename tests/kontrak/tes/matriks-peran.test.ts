// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { buatBookingPublik, masukStaf, siapkanBengkel, type Bengkel } from '../src/data';
import { jalankan } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type OpsiMinta, type Respons } from '../src/klien';
import { badanUtf8Rusak, jsonLebihDariSatuMib, JSON_RUSAK, tokenAcak } from './pembantu-fondasi';
import { operasiSpec } from './pembantu-uang';

// Matriks izin di deskripsi API (spec/openapi.yaml, "Peran dan sesi"), satu
// baris per operasi staf (42) ditambah 10 rute publik = 52 operasi. Setiap
// rute dipanggil dalam bentuk "kosong": sumber di path sengaja tidak ada
// dan/atau badan sengaja tidak sah. Karena urutan 401 → 403 (peran) → 404 →
// 422, peran yang tidak berhak tetap mendapat 401/403, sedangkan peran yang
// berhak sampai ke 404/422/200. Panggilan dengan data sungguhan dan batas
// mekanik ada di matriks-peran-nyata.test.ts.

type Peran = 'owner' | 'cashier' | 'mechanic';
type Izin = 'semua' | 'kasir' | 'pemilik';
const BOLEH: Record<Izin, Peran[]> = { semua: ['owner', 'cashier', 'mechanic'], kasir: ['owner', 'cashier'], pemilik: ['owner'] };

interface Hasil {
  status: number;
  code?: string;
  fields?: Record<string, string>;
}

interface Rute {
  nama: string;
  izin: Izin;
  json?: unknown;
  hasil: Hasil;
}

const ID = randomUUID();
const ok: Hasil = { status: 200 };
const tidakAda: Hasil = { status: 404, code: 'not_found' };
const takSah = (fields?: Record<string, string>): Hasil => ({ status: 422, code: 'validation_failed', fields });

// "METODE /template" → metode dan path dengan ID acak (UUID yang tidak ada)
// dan nomor SPK yang tidak ada.
function bagian(nama: string): { metode: 'get' | 'post' | 'put' | 'patch' | 'delete'; path: string } {
  const [m, template] = nama.split(' ') as [string, string];
  return { metode: m.toLowerCase() as never, path: template.replace('{number}', 'S-9999').replace(/\{[^}]+\}/g, ID) };
}

const RUTE: Rute[] = [
  { nama: 'GET /api/staff/me', izin: 'semua', hasil: ok },
  // Logout hanya diuji 401/403 di sini (berhasil berarti token mati); berhasilnya di berkas nyata.
  { nama: 'POST /api/staff/logout', izin: 'semua', hasil: { status: 204 } },
  { nama: 'GET /api/staff', izin: 'pemilik', hasil: ok },
  { nama: 'POST /api/staff', izin: 'pemilik', json: {}, hasil: takSah() },
  { nama: 'PATCH /api/staff/{staffId}', izin: 'pemilik', json: {}, hasil: tidakAda },
  { nama: 'GET /api/mechanics', izin: 'kasir', hasil: ok },
  { nama: 'PUT /api/outlet', izin: 'pemilik', json: {}, hasil: takSah() },
  { nama: 'GET /api/customers', izin: 'kasir', hasil: ok },
  { nama: 'POST /api/customers', izin: 'kasir', json: {}, hasil: takSah() },
  { nama: 'GET /api/customers/{customerId}', izin: 'kasir', hasil: tidakAda },
  { nama: 'PATCH /api/customers/{customerId}', izin: 'kasir', json: {}, hasil: tidakAda },
  { nama: 'POST /api/customers/{customerId}/vehicles', izin: 'kasir', json: {}, hasil: tidakAda },
  { nama: 'GET /api/vehicles', izin: 'kasir', hasil: takSah({ plate: 'required' }) },
  { nama: 'PATCH /api/vehicles/{vehicleId}', izin: 'kasir', json: {}, hasil: tidakAda },
  { nama: 'GET /api/vehicles/{vehicleId}/work-orders', izin: 'kasir', hasil: tidakAda },
  { nama: 'GET /api/services', izin: 'semua', hasil: ok },
  { nama: 'POST /api/services', izin: 'pemilik', json: {}, hasil: takSah() },
  { nama: 'PATCH /api/services/{serviceId}', izin: 'pemilik', json: {}, hasil: tidakAda },
  { nama: 'GET /api/parts', izin: 'semua', hasil: ok },
  { nama: 'POST /api/parts', izin: 'pemilik', json: {}, hasil: takSah() },
  { nama: 'PATCH /api/parts/{partId}', izin: 'pemilik', json: {}, hasil: tidakAda },
  { nama: 'GET /api/parts/{partId}/movements', izin: 'pemilik', hasil: tidakAda },
  { nama: 'POST /api/parts/{partId}/stock-in', izin: 'pemilik', json: { quantity: 1 }, hasil: tidakAda },
  { nama: 'POST /api/parts/{partId}/stock-out', izin: 'pemilik', json: { quantity: 1, note: 'Rusak' }, hasil: tidakAda },
  { nama: 'POST /api/parts/{partId}/stock-count', izin: 'pemilik', json: { countedStock: 1, note: 'Opname' }, hasil: tidakAda },
  { nama: 'GET /api/bookings', izin: 'kasir', hasil: ok },
  { nama: 'GET /api/bookings/{bookingId}', izin: 'kasir', hasil: tidakAda },
  { nama: 'POST /api/bookings/{bookingId}/confirm', izin: 'kasir', hasil: tidakAda },
  { nama: 'POST /api/bookings/{bookingId}/reject', izin: 'kasir', json: { reason: 'Bengkel tutup.' }, hasil: tidakAda },
  { nama: 'POST /api/bookings/{bookingId}/convert', izin: 'kasir', json: {}, hasil: tidakAda },
  { nama: 'GET /api/work-orders', izin: 'semua', hasil: ok },
  { nama: 'POST /api/work-orders', izin: 'kasir', json: {}, hasil: takSah({ vehicleId: 'required', complaint: 'required' }) },
  { nama: 'GET /api/work-orders/{number}', izin: 'semua', hasil: tidakAda },
  { nama: 'PATCH /api/work-orders/{number}', izin: 'semua', json: {}, hasil: tidakAda },
  { nama: 'POST /api/work-orders/{number}/status', izin: 'semua', json: { status: 'IN_PROGRESS' }, hasil: tidakAda },
  { nama: 'POST /api/work-orders/{number}/cancel', izin: 'kasir', json: { reason: 'Batal saja.' }, hasil: tidakAda },
  { nama: 'POST /api/work-orders/{number}/items', izin: 'kasir', json: { type: 'SERVICE', serviceId: ID, quantity: 1 }, hasil: tidakAda },
  { nama: 'DELETE /api/work-orders/{number}/items/{itemId}', izin: 'kasir', hasil: tidakAda },
  { nama: 'POST /api/work-orders/{number}/payments', izin: 'kasir', json: { amount: 1000, method: 'cash' }, hasil: tidakAda },
  { nama: 'POST /api/work-orders/{number}/wa', izin: 'kasir', json: { type: 'receipt' }, hasil: tidakAda },
  { nama: 'POST /api/work-orders/{number}/tracking-link', izin: 'kasir', hasil: tidakAda },
  { nama: 'GET /api/reports/daily', izin: 'pemilik', hasil: takSah({ date: 'required' }) },
];

const PUBLIK: Array<{ nama: string; json?: unknown; path?: string }> = [
  { nama: 'GET /api/health' },
  { nama: 'GET /api/setup' },
  { nama: 'POST /api/setup', json: {} },
  { nama: 'POST /api/staff/login', json: {} },
  { nama: 'GET /api/outlet' },
  { nama: 'GET /api/public/services' },
  { nama: 'POST /api/public/bookings', json: {} },
  { nama: 'GET /api/public/bookings/{bookingToken}' },
  { nama: 'POST /api/public/bookings/{bookingToken}/cancel' },
  { nama: 'GET /api/public/work-orders/{trackingToken}' },
];

const BUKAN_KELUAR = RUTE.filter((r) => r.nama !== 'POST /api/staff/logout');
const BERBADAN_JSON = RUTE.filter((r) => r.json !== undefined);
const SEL_TERLARANG = RUTE.flatMap((r) =>
  (['owner', 'cashier', 'mechanic'] as const).filter((p) => !BOLEH[r.izin].includes(p)).map((peran) => ({ ...r, peran, judul: `${peran} → ${r.nama}` })),
);
const SEL_BOLEH = BUKAN_KELUAR.flatMap((r) => BOLEH[r.izin].map((peran) => ({ ...r, peran, judul: `${peran} → ${r.nama}` })));

let b: Bengkel;
const token = (p: Peran): string => ({ owner: b.pemilik.token, cashier: b.kasir.token, mechanic: b.mekanik.token })[p];

function panggil(r: { nama: string; json?: unknown }, tokenPeminta?: string, badan?: OpsiMinta): Promise<Respons> {
  const { metode, path } = bagian(r.nama);
  const isi: OpsiMinta = badan ?? (r.json !== undefined ? { json: r.json } : {});
  return api[metode](path, { ...isi, token: tokenPeminta });
}

function harapHasil(res: Respons, h: Hasil): void {
  if (h.code) {
    harapGalat(res, h.status, h.code, h.fields);
  } else {
    harapStatus(res, h.status);
  }
}

beforeAll(async () => {
  b = await siapkanBengkel();
});

describe('cakupan: tabel ini memuat semua 52 operasi spec', () => {
  it('42 operasi staf dan 10 operasi publik, tidak ada yang terlewat atau berlebih', () => {
    const spec = operasiSpec();

    expect(RUTE.map((r) => r.nama).sort()).toEqual(spec.staf);
    expect(PUBLIK.map((r) => r.nama).sort()).toEqual(spec.publik);
    expect(spec.staf.length + spec.publik.length).toBe(52);
  });
});

describe('tanpa token atau token tidak sah → 401 di semua 42 rute staf (sebelum 403, 404, dan 422)', () => {
  it.each(RUTE)('$nama', async (r) => {
    harapGalat(await panggil(r), 401, 'unauthenticated');
    harapGalat(await panggil(r, 'x'.repeat(43)), 401, 'unauthenticated');
    harapGalat(await panggil(r, tokenAcak()), 401, 'unauthenticated');
    harapGalat(await panggil(r, undefined, { ...(r.json !== undefined ? { json: r.json } : {}), header: { Authorization: `Basic ${b.pemilik.token}` } }), 401, 'unauthenticated');
  });
});

describe('peran yang tidak berhak → 403 forbidden (mengalahkan 404 dan 422)', () => {
  it.each(SEL_TERLARANG)('$judul', async (r) => {
    harapGalat(await panggil(r, token(r.peran)), 403, 'forbidden');
  });
});

describe('peran yang berhak tidak pernah 403: lolos ke 404, 422, atau 200', () => {
  it.each(SEL_BOLEH)('$judul', async (r) => {
    harapHasil(await panggil(r, token(r.peran)), r.hasil);
  });
});

describe('rute publik tidak pernah memeriksa token: tanpa token tidak ada 401 maupun 403 forbidden', () => {
  it.each(PUBLIK)('$nama', async (r) => {
    const { metode, path } = bagian(r.nama.replace(/\{(bookingToken|trackingToken)\}/, tokenAcak()));
    const res = await api[metode](path, r.json !== undefined ? { json: r.json } : {});

    expect(res.status, `${r.nama} → ${res.status}`).not.toBe(401);
    expect(res.body?.error?.code).not.toBe('forbidden');
  });
});

describe('urutan pemeriksaan rute staf berbadan JSON: 413 → 400 → 401 → 403 → 404 → 422', () => {
  it.each(BERBADAN_JSON)('JSON rusak, bukan objek, atau UTF-8 rusak → 400 sebelum 401 dan 403: $nama', async (r) => {
    harapGalat(await panggil(r, undefined, { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await panggil(r, token('mechanic'), { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await panggil(r, undefined, { mentah: '[]' }), 400, 'bad_request');
    harapGalat(await panggil(r, undefined, { biner: badanUtf8Rusak() }), 400, 'bad_request');
  });

  it.each(BERBADAN_JSON)('badan lebih dari 1 MiB → 413 sebelum 400, 401, dan 403: $nama', async (r) => {
    harapGalat(await panggil(r, undefined, { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await panggil(r, token('mechanic'), { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
  });

  it('401 → 403 → 404 → 422 pada satu rute: PATCH /api/services/{serviceId}', async () => {
    const jalan = `/api/services/${b.gantiOli.serviceId}`;
    const tidakSah = { price: 'mahal' };

    harapGalat(await api.patch(jalan, { json: tidakSah }), 401, 'unauthenticated');
    harapGalat(await api.patch(jalan, { token: token('cashier'), json: tidakSah }), 403, 'forbidden');
    harapGalat(await api.patch(`/api/services/${ID}`, { token: token('mechanic'), json: tidakSah }), 403, 'forbidden');
    harapGalat(await api.patch(`/api/services/${ID}`, { token: token('owner'), json: tidakSah }), 404, 'not_found');
    harapGalat(await api.patch(jalan, { token: token('owner'), json: tidakSah }), 422, 'validation_failed', { price: 'invalid_type' });
  });

  it('rute kasir tanpa badan (rekap pemilik dan riwayat servis): 401 → 403 → 404 → 422 query', async () => {
    harapGalat(await api.get('/api/reports/daily', { query: { date: 'kemarin' } }), 401, 'unauthenticated');
    harapGalat(await api.get('/api/reports/daily', { token: token('cashier'), query: { date: 'kemarin' } }), 403, 'forbidden');
    harapGalat(await api.get('/api/reports/daily', { token: token('owner'), query: { date: 'kemarin' } }), 422, 'validation_failed', { date: 'invalid_format' });
    harapGalat(await api.get(`/api/vehicles/${ID}/work-orders`, { token: token('mechanic'), query: { page: '0' } }), 403, 'forbidden');
    harapGalat(await api.get(`/api/vehicles/${ID}/work-orders`, { token: token('cashier'), query: { page: '0' } }), 404, 'not_found');
  });
});

describe('rute staf tanpa badan mengabaikan badan sepenuhnya (tanpa 400 dan 413)', () => {
  const TANPA_BADAN = ['POST /api/bookings/{bookingId}/confirm', 'POST /api/work-orders/{number}/tracking-link'];

  it.each(TANPA_BADAN)('%s: JSON rusak tanpa token → 401, mekanik → 403, kasir → 404', async (nama) => {
    for (const mentah of [JSON_RUSAK, jsonLebihDariSatuMib()]) {
      harapGalat(await panggil({ nama }, undefined, { mentah }), 401, 'unauthenticated');
      harapGalat(await panggil({ nama }, token('mechanic'), { mentah }), 403, 'forbidden');
      harapGalat(await panggil({ nama }, token('cashier'), { mentah }), 404, 'not_found');
    }
  });

  it('konfirmasi booking sungguhan dengan badan rusak tetap 200', async () => {
    const { bookingId } = await buatBookingPublik();

    harapStatus(await api.post(`/api/bookings/${bookingId}/confirm`, { token: token('cashier'), mentah: JSON_RUSAK }), 200);
  });

  it('logout dengan badan rusak: tanpa token 401, dengan token 204', async () => {
    const sesi = await masukStaf(b.mekanik.staff.email);

    harapGalat(await api.post('/api/staff/logout', { mentah: JSON_RUSAK }), 401, 'unauthenticated');
    harapStatus(await api.post('/api/staff/logout', { token: sesi.token, mentah: JSON_RUSAK }), 204);
  });
});

describe('peran dibaca dari database pada setiap permintaan', () => {
  it('kasir yang diturunkan menjadi mekanik langsung ditolak rute kasir, dan langsung boleh lagi setelah dikembalikan', async () => {
    const sesi = await masukStaf(b.kasir.staff.email);
    harapStatus(await api.get('/api/customers', { token: sesi.token }), 200);

    await jalankan("UPDATE staff SET role = 'mechanic' WHERE staff_id = ?", [b.kasir.staff.staffId]);
    try {
      harapGalat(await api.get('/api/customers', { token: sesi.token }), 403, 'forbidden');
      harapStatus(await api.get('/api/work-orders', { token: sesi.token }), 200);
    } finally {
      await jalankan("UPDATE staff SET role = 'cashier' WHERE staff_id = ?", [b.kasir.staff.staffId]);
    }

    harapStatus(await api.get('/api/customers', { token: sesi.token }), 200);
  });

  it('kasir yang dinaikkan menjadi pemilik lewat PATCH langsung boleh membuka rute pemilik', async () => {
    const kasir = await masukStaf(b.kasir.staff.email);
    harapGalat(await api.get('/api/staff', { token: kasir.token }), 403, 'forbidden');

    harapStatus(await api.patch(`/api/staff/${b.kasir.staff.staffId}`, { token: token('owner'), json: { role: 'owner' } }), 200);
    try {
      harapStatus(await api.get('/api/staff', { token: kasir.token }), 200);
    } finally {
      harapStatus(await api.patch(`/api/staff/${b.kasir.staff.staffId}`, { token: token('owner'), json: { role: 'cashier' } }), 200);
    }
    harapGalat(await api.get('/api/staff', { token: kasir.token }), 403, 'forbidden');
  });
});
