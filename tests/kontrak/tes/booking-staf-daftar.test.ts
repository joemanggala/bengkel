// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import { buatBookingPublik, jadikanSpk, konfirmasiBooking, nomorUnik, platUnik, siapkanBengkel, tolakBooking, wajib, type Bengkel } from '../src/data';
import { jalankan, kosongkanSpkDanBooking, teksUtc, urutkanBooking, waktuDatabase } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { batalkanBookingPublik, daftarBooking, rincianBooking, tanggalWibAman } from './pembantu-booking';

// GET /api/bookings: urutan, paginasi, filter status, tanggal datang, dan
// pencarian, serta validasi query. Blok yang butuh daftar persis mulai dari
// tabel booking kosong (kosongkanSpkDanBooking; berkas ini tidak membuat item
// sparepart).

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
});

function nomorDi(res: { body: any }): string[] {
  return res.body.data.map((x: any) => x.number);
}

describe('daftar, urutan, dan paginasi', () => {
  beforeEach(async () => {
    await kosongkanSpkDanBooking();
  });

  it('tanpa booking → data kosong dengan meta page 1, limit 20, total 0', async () => {
    const res = await daftarBooking(b.kasir.token);

    harapStatus(res, 200);
    expect(res.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it('urut created_at terbaru dulu; tiap baris sama dengan rincian booking', async () => {
    const semua = [await buatBookingPublik(), await buatBookingPublik({ serviceId: b.gantiOli.serviceId }), await buatBookingPublik()];
    await urutkanBooking(semua.map((x) => x.booking.number));

    const res = await daftarBooking(b.pemilik.token);

    harapStatus(res, 200);
    expect(nomorDi(res)).toEqual(semua.map((x) => x.booking.number).reverse());
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 3 });
    for (const baris of res.body.data) {
      harapSetara(baris, (await rincianBooking(b.kasir.token, baris.bookingId)).body.data);
    }
  });

  it('created_at sama → booking_id turun', async () => {
    const semua = [await buatBookingPublik(), await buatBookingPublik(), await buatBookingPublik(), await buatBookingPublik()];
    await jalankan('UPDATE bookings SET created_at = ?', [teksUtc(await waktuDatabase())]);

    const res = await daftarBooking(b.kasir.token);

    const harapan = [...semua].sort((x, y) => (x.bookingId < y.bookingId ? 1 : -1)).map((x) => x.booking.number);
    expect(nomorDi(res)).toEqual(harapan);
  });

  it('limit dan page memotong daftar; total tetap semua yang cocok; halaman lewat batas kosong', async () => {
    const semua = [];
    for (let i = 0; i < 5; i += 1) {
      semua.push((await buatBookingPublik()).booking.number);
    }
    await urutkanBooking(semua);
    const terbaru = [...semua].reverse();

    const halaman = async (page: number) => daftarBooking(b.kasir.token, { limit: 2, page });
    for (const [page, isi] of [
      [1, terbaru.slice(0, 2)],
      [2, terbaru.slice(2, 4)],
      [3, terbaru.slice(4)],
      [4, []],
    ] as const) {
      const res = await halaman(page);
      expect(nomorDi(res), `page ${page}`).toEqual(isi);
      expect(res.body.meta).toEqual({ page, limit: 2, total: 5 });
    }
    expect((await daftarBooking(b.kasir.token, { limit: 50 })).body.meta).toEqual({ page: 1, limit: 50, total: 5 });
    expect((await daftarBooking(b.kasir.token, { page: 1000000 })).body).toEqual({ data: [], meta: { page: 1000000, limit: 20, total: 5 } });
  });
});

describe('filter status, tanggal datang, dan pencarian', () => {
  const nomor: Record<'A' | 'B' | 'C' | 'D' | 'E', string> = { A: '', B: '', C: '', D: '', E: '' };
  let hariIni = '';
  let besok = '';
  let lusa = '';

  // A dikonfirmasi, B ditolak, C menunggu, D dibatalkan pelanggan, E dijadikan
  // SPK. Urutan dibuat: A paling lama, E paling baru.
  beforeAll(async () => {
    await kosongkanSpkDanBooking();
    hariIni = await tanggalWibAman(0);
    besok = await tanggalWibAman(1);
    lusa = await tanggalWibAman(2);
    const a = await buatBookingPublik({ customerName: 'Joko Prasetyo', phone: '6285711112222', plate: 'D 4321 AB', visitDate: hariIni });
    const bb = await buatBookingPublik({ customerName: 'José Ramírez', phone: '6285733334444', plate: 'F 8765 CD', visitDate: besok });
    const c = await buatBookingPublik({ customerName: 'Rina 100%_x', phone: '6285755556666', plate: 'Z 1111 ZZ', visitDate: besok });
    const d = await buatBookingPublik({ customerName: 'Dodi', phone: nomorUnik(), plate: platUnik(), visitDate: lusa });
    const e = await buatBookingPublik({ customerName: 'Eko', phone: nomorUnik(), plate: platUnik(), visitDate: hariIni });
    await konfirmasiBooking(b.kasir.token, a.bookingId);
    await tolakBooking(b.kasir.token, bb.bookingId);
    wajib(await batalkanBookingPublik(d.bookingToken), 200);
    await jadikanSpk(b.kasir.token, e.bookingId);
    Object.assign(nomor, { A: a.booking.number, B: bb.booking.number, C: c.booking.number, D: d.booking.number, E: e.booking.number });
    await urutkanBooking([nomor.A, nomor.B, nomor.C, nomor.D, nomor.E]);
  });

  async function cari(query: Record<string, string>): Promise<string[]> {
    const res = await daftarBooking(b.kasir.token, query);
    harapStatus(res, 200);
    expect(res.body.meta.total).toBe(res.body.data.length);
    return nomorDi(res);
  }

  it.each([
    ['PENDING', ['C']],
    ['CONFIRMED', ['A']],
    ['REJECTED', ['B']],
    ['CANCELLED', ['D']],
    ['CONVERTED', ['E']],
  ] as const)('status=%s', async (status, harapan) => {
    expect(await cari({ status })).toEqual(harapan.map((k) => nomor[k]));
  });

  it('visitDate hanya tanggal datang itu; tanggal tanpa booking → kosong', async () => {
    expect(await cari({ visitDate: hariIni })).toEqual([nomor.E, nomor.A]);
    expect(await cari({ visitDate: besok })).toEqual([nomor.C, nomor.B]);
    expect(await cari({ visitDate: lusa })).toEqual([nomor.D]);
    expect(await cari({ visitDate: await tanggalWibAman(3) })).toEqual([]);
  });

  it('nama pemesan: sebagian teks, tanpa membedakan huruf besar/kecil dan aksen', async () => {
    expect(await cari({ search: 'joko' })).toEqual([nomor.A]);
    expect(await cari({ search: 'PRASET' })).toEqual([nomor.A]);
    expect(await cari({ search: 'jose ram' })).toEqual([nomor.B]);
  });

  it('% dan _ dicocokkan apa adanya, bukan wildcard', async () => {
    expect(await cari({ search: '%' })).toEqual([nomor.C]);
    expect(await cari({ search: '_' })).toEqual([nomor.C]);
    expect(await cari({ search: '100%_' })).toEqual([nomor.C]);
  });

  it('nomor booking: huruf kecil dibesarkan dan cocok sebagian', async () => {
    expect(await cari({ search: nomor.C.toLowerCase() })).toEqual([nomor.C]);
    expect(await cari({ search: 'b-000' })).toEqual([nomor.E, nomor.D, nomor.C, nomor.B, nomor.A]);
  });

  it('nomor HP dalam bentuk 08…, +62 …, atau potongan angka', async () => {
    expect(await cari({ search: '0857-1111' })).toEqual([nomor.A]);
    expect(await cari({ search: '+62 857 3333' })).toEqual([nomor.B]);
    expect(await cari({ search: '55556666' })).toEqual([nomor.C]);
  });

  it('plat dalam bentuk apa pun memakai kunci plat', async () => {
    expect(await cari({ search: 'd 4321' })).toEqual([nomor.A]);
    expect(await cari({ search: '8765c' })).toEqual([nomor.B]);
    expect(await cari({ search: 'z-1111-zz' })).toEqual([nomor.C]);
  });

  it('search kosong sesudah dipangkas berarti tanpa filter; tidak ada yang cocok → kosong', async () => {
    expect(await cari({ search: '   ' })).toHaveLength(5);
    expect(await cari({ search: 'tidakadayangcocok' })).toEqual([]);
  });

  it('"+" di query berarti spasi; byte UTF-8 tidak sah tidak pernah cocok (200 kosong)', async () => {
    const plus = await api.get('/api/bookings?search=Joko+Prasetyo', { token: b.kasir.token });
    expect(nomorDi(plus)).toEqual([nomor.A]);

    const rusak = await api.get('/api/bookings?search=%FF', { token: b.kasir.token });
    harapStatus(rusak, 200);
    expect(rusak.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it('filter bisa digabung; meta.total mengikuti gabungan filter', async () => {
    expect(await cari({ status: 'PENDING', visitDate: besok })).toEqual([nomor.C]);
    expect(await cari({ search: 'jose', status: 'PENDING' })).toEqual([]);
    expect(await cari({ search: 'b-000', visitDate: hariIni })).toEqual([nomor.E, nomor.A]);

    const res = await daftarBooking(b.kasir.token, { search: 'b-000', limit: 2, page: 2 });
    expect(nomorDi(res)).toEqual([nomor.C, nomor.B]);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 5 });
  });
});

describe('validasi query → 422 dengan fields persis', () => {
  it.each<[string, Record<string, string>, Record<string, string>]>([
    ['status kosong', { status: '' }, { status: 'invalid_format' }],
    ['status huruf kecil', { status: 'pending' }, { status: 'invalid_format' }],
    ['status SPK', { status: 'DONE' }, { status: 'invalid_format' }],
    ['visitDate kosong', { visitDate: '' }, { visitDate: 'invalid_format' }],
    ['visitDate DD-MM-YYYY', { visitDate: '28-11-2026' }, { visitDate: 'invalid_format' }],
    ['visitDate 30 Februari', { visitDate: '2026-02-30' }, { visitDate: 'invalid_format' }],
    ['visitDate dengan jam', { visitDate: '2026-11-28T00:00:00' }, { visitDate: 'invalid_format' }],
    ['page kosong', { page: '' }, { page: 'invalid_format' }],
    ['page huruf', { page: 'abc' }, { page: 'invalid_format' }],
    ['page negatif', { page: '-1' }, { page: 'invalid_format' }],
    ['page pecahan', { page: '1.5' }, { page: 'invalid_format' }],
    ['page bertanda +', { page: '+1' }, { page: 'invalid_format' }],
    ['page 0', { page: '0' }, { page: 'out_of_range' }],
    ['page 1.000.001', { page: '1000001' }, { page: 'out_of_range' }],
    ['limit kosong', { limit: '' }, { limit: 'invalid_format' }],
    ['limit huruf', { limit: 'x' }, { limit: 'invalid_format' }],
    ['limit 0', { limit: '0' }, { limit: 'out_of_range' }],
    ['limit 51', { limit: '51' }, { limit: 'out_of_range' }],
    ['semua sekaligus', { status: 'x', visitDate: 'x', page: '0', limit: '51' }, { status: 'invalid_format', visitDate: 'invalid_format', page: 'out_of_range', limit: 'out_of_range' }],
  ])('%s', async (_nama, query, fields) => {
    harapGalat(await daftarBooking(b.kasir.token, query), 422, 'validation_failed', fields);
  });

  it('titik koma adalah data biasa: limit=1;page=2 → limit invalid_format', async () => {
    harapGalat(await api.get('/api/bookings?limit=1;page=2', { token: b.kasir.token }), 422, 'validation_failed', { limit: 'invalid_format' });
  });

  it('urutan 401 → 403 → 422: query salah tanpa token 401, oleh mekanik 403', async () => {
    harapGalat(await api.get('/api/bookings', { query: { status: 'x' } }), 401, 'unauthenticated');
    harapGalat(await daftarBooking(b.mekanik.token, { status: 'x', limit: '0' }), 403, 'forbidden');
  });
});
