// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// GET /api/work-orders (papan servis): bentuk baris, urutan, paginasi, filter status,
// scope, mekanik, dan tanggal WIB, pencarian nomor/plat/nama/HP, mekanik hanya melihat
// SPK miliknya, dan validasi query. Setiap blok mengosongkan SPK lebih dulu sehingga
// daftar hanya berisi SPK buatannya sendiri; berkas ini tidak membuat item sparepart.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import {
  bayar,
  buatMekanik,
  buatPelangganDenganKendaraan,
  buatSpk,
  detailSpk,
  siapkanBengkel,
  tambahJasa,
  tambahKendaraan,
  type Bengkel,
  type SesiStaf,
} from '../src/data';
import { aturWaktuSpk, idSpk, kosongkanSpkDanBooking, setAktif, urutkanSpk } from '../src/db';
import { rentangUtcTanggalWib } from '../src/format';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { tokenAcak } from './pembantu-fondasi';
import { daftarSpk, nomorDaftar, ringkasStaf, spkDiStatus, type StatusSpk } from './pembantu-spk';

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
});

const spk = (ubah: Record<string, unknown> = {}) => buatSpk(b.kasir.token, b.kendaraan.vehicleId, ubah);

describe('GET /api/work-orders: bentuk baris, urutan, dan paginasi', () => {
  let nomor: string[];

  beforeAll(async () => {
    await kosongkanSpkDanBooking();
    nomor = [];
    for (let i = 0; i < 5; i += 1) {
      nomor.push((await spk()).number);
    }
    // S-0001 paling lama, S-0005 paling baru.
    await urutkanSpk(nomor);
  });

  it('baris SpkRingkas diturunkan dari rincian SPK; itemCount = jumlah baris item, bukan jumlah quantity', async () => {
    const n = nomor[4]!;
    await tambahJasa(b.kasir.token, n, b.gantiOli.serviceId, 3);
    await tambahJasa(b.kasir.token, n, b.cekKelistrikan.serviceId, 1);
    await bayar(b.kasir.token, n, 10_000);
    const d = await detailSpk(b.kasir.token, n);

    const baris = (await daftarSpk(b.kasir.token)).body.data.find((s: any) => s.number === n);

    harapSetara(baris, {
      number: d.number,
      status: d.status,
      paymentStatus: 'partial',
      customer: d.customer,
      vehicle: { vehicleId: d.vehicle.vehicleId, type: d.vehicle.type, plate: d.vehicle.plate, brand: d.vehicle.brand, model: d.vehicle.model },
      mechanic: null,
      complaint: d.complaint,
      itemCount: 2,
      total: 155_000,
      paidAmount: 10_000,
      estimatedDoneAt: null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    });
  });

  it('urutan bawaan created_at terbaru dulu; sort=newest sama; sort=oldest kebalikannya', async () => {
    expect(await nomorDaftar(b.kasir.token)).toEqual([...nomor].reverse());
    expect(await nomorDaftar(b.kasir.token, { sort: 'newest' })).toEqual([...nomor].reverse());
    expect(await nomorDaftar(b.kasir.token, { sort: 'oldest' })).toEqual(nomor);
  });

  it('created_at sama → work_order_id turun (oldest: naik)', async () => {
    await aturWaktuSpk(nomor[0]!, '2026-01-01 03:00:00.000');
    await aturWaktuSpk(nomor[1]!, '2026-01-01 03:00:00.000');
    // Keduanya kini paling lama; di antara keduanya penentunya work_order_id.
    const [a, c] = [nomor[0]!, nomor[1]!];
    const turun = (await idSpk(a)) > (await idSpk(c)) ? [a, c] : [c, a];

    const terbaru = await nomorDaftar(b.kasir.token);
    const terlama = await nomorDaftar(b.kasir.token, { sort: 'oldest' });

    expect(terbaru.slice(-2)).toEqual(turun);
    expect(terlama.slice(0, 2)).toEqual([...turun].reverse());
    await urutkanSpk(nomor);
  });

  it('paginasi: limit dan page memotong daftar; meta.total = semua baris yang cocok; halaman lewat akhir kosong', async () => {
    const terbaru = [...nomor].reverse();

    const h1 = await daftarSpk(b.kasir.token, { limit: 2 });
    const h3 = await daftarSpk(b.kasir.token, { limit: 2, page: 3 });
    const h4 = await daftarSpk(b.kasir.token, { limit: 2, page: 4 });
    const bawaan = await daftarSpk(b.kasir.token);

    expect(h1.body.data.map((s: any) => s.number)).toEqual(terbaru.slice(0, 2));
    expect(h1.body.meta).toEqual({ page: 1, limit: 2, total: 5 });
    expect(h3.body.data.map((s: any) => s.number)).toEqual(terbaru.slice(4));
    expect(h4.body).toEqual({ data: [], meta: { page: 4, limit: 2, total: 5 } });
    expect(bawaan.body.meta).toEqual({ page: 1, limit: 20, total: 5 });
  });

  it('pemilik juga melihat semua SPK', async () => {
    expect((await daftarSpk(b.pemilik.token)).body.meta.total).toBe(5);
  });
});

describe('GET /api/work-orders: filter status dan scope', () => {
  const per: Partial<Record<StatusSpk, string>> = {};

  beforeAll(async () => {
    await kosongkanSpkDanBooking();
    for (const s of ['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP', 'CANCELLED'] as StatusSpk[]) {
      per[s] = (await spkDiStatus(b, s)).number;
    }
  });

  it.each<StatusSpk>(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP', 'CANCELLED'])('status=%s hanya SPK berstatus itu', async (s) => {
    const res = await daftarSpk(b.kasir.token, { status: s });

    expect(res.body.data.map((x: any) => [x.number, x.status])).toEqual([[per[s], s]]);
    expect(res.body.meta.total).toBe(1);
  });

  it('scope=active = QUEUED, IN_PROGRESS, WAITING_PARTS, DONE; scope=history = PICKED_UP dan CANCELLED', async () => {
    const aktif = await nomorDaftar(b.kasir.token, { scope: 'active' });
    const riwayat = await nomorDaftar(b.kasir.token, { scope: 'history' });

    expect(aktif.sort()).toEqual([per.QUEUED, per.IN_PROGRESS, per.WAITING_PARTS, per.DONE].sort());
    expect(riwayat.sort()).toEqual([per.PICKED_UP, per.CANCELLED].sort());
  });

  it('scope dan status digabung sebagai irisan', async () => {
    expect(await nomorDaftar(b.kasir.token, { scope: 'history', status: 'QUEUED' })).toEqual([]);
    expect(await nomorDaftar(b.kasir.token, { scope: 'active', status: 'DONE' })).toEqual([per.DONE]);
    expect(await nomorDaftar(b.kasir.token, { scope: 'history', status: 'CANCELLED' })).toEqual([per.CANCELLED]);
  });
});

describe('GET /api/work-orders: filter mekanik dan batas mekanik', () => {
  let andi: SesiStaf;
  let budi: SesiStaf;
  let kosong: SesiStaf;
  const milik: Record<string, string[]> = {};

  beforeAll(async () => {
    await kosongkanSpkDanBooking();
    andi = await buatMekanik({ name: 'Andi Mekanik' });
    budi = await buatMekanik({ name: 'Budi Mekanik' });
    kosong = await buatMekanik({ name: 'Mekanik Baru' });
    milik.andi = [(await spk({ mechanicId: andi.staff.staffId })).number, (await spkDiStatus(b, 'IN_PROGRESS', { mekanik: andi })).number];
    milik.budi = [(await spk({ mechanicId: budi.staff.staffId })).number];
    milik.tanpa = [(await spk()).number];
  });

  it('kasir: mechanicId hanya SPK mekanik itu; UUID tak dikenal → daftar kosong 200', async () => {
    expect((await nomorDaftar(b.kasir.token, { mechanicId: andi.staff.staffId })).sort()).toEqual([...milik.andi!].sort());
    expect(await nomorDaftar(b.kasir.token, { mechanicId: budi.staff.staffId })).toEqual(milik.budi);
    expect(await nomorDaftar(b.kasir.token, { mechanicId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })).toEqual([]);
    expect(await nomorDaftar(b.kasir.token)).toEqual(expect.arrayContaining([...milik.andi!, ...milik.budi!, ...milik.tanpa!]));
  });

  it('mekanik hanya menerima SPK miliknya; meta.total ikut tersaring', async () => {
    const res = await daftarSpk(andi.token);

    expect(res.body.data.map((s: any) => s.number).sort()).toEqual([...milik.andi!].sort());
    expect(res.body.meta.total).toBe(2);
    for (const s of res.body.data) {
      expect(s.mechanic).toEqual(ringkasStaf(andi));
    }
  });

  it('mekanik: mechanicId milik mekanik lain diabaikan (tetap hanya miliknya)', async () => {
    expect((await nomorDaftar(andi.token, { mechanicId: budi.staff.staffId })).sort()).toEqual([...milik.andi!].sort());
    expect(await nomorDaftar(budi.token, { mechanicId: andi.staff.staffId })).toEqual(milik.budi);
  });

  it('mekanik: mechanicId tetap diperiksa formatnya (422 sebelum diabaikan)', async () => {
    harapGalat(await daftarSpk(andi.token, { mechanicId: 'andi' }), 422, 'validation_failed', { mechanicId: 'invalid_format' });
  });

  it('mekanik tanpa SPK menerima daftar kosong; filter lain tetap berlaku untuk mekanik', async () => {
    expect((await daftarSpk(kosong.token)).body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
    expect(await nomorDaftar(andi.token, { status: 'IN_PROGRESS' })).toEqual([milik.andi![1]]);
  });

  it('mekanik yang sudah nonaktif tetap ditampilkan di baris SPK', async () => {
    const lama = await buatMekanik({ name: 'Mekanik Pensiun' });
    const n = (await spk({ mechanicId: lama.staff.staffId })).number;
    await setAktif('staff', lama.staff.staffId, false);

    const baris = (await daftarSpk(b.kasir.token, { mechanicId: lama.staff.staffId })).body.data;

    expect(baris.map((s: any) => [s.number, s.mechanic])).toEqual([[n, ringkasStaf(lama)]]);
  });
});

describe('GET /api/work-orders: filter tanggal WIB', () => {
  // Rentang 2026-03-10 WIB = [2026-03-09T17:00:00.000Z, 2026-03-10T17:00:00.000Z).
  const tgl = '2026-03-10';
  const no: Record<string, string> = {};

  beforeAll(async () => {
    await kosongkanSpkDanBooking();
    const { mulai, akhir } = rentangUtcTanggalWib(tgl);
    const waktu: Record<string, Date> = {
      sebelum: new Date(mulai.getTime() - 1),
      awal: mulai,
      tengah: new Date('2026-03-10T05:00:00.000Z'),
      akhirHari: new Date(akhir.getTime() - 1),
      sesudah: akhir,
    };
    for (const [nama, w] of Object.entries(waktu)) {
      no[nama] = (await spk()).number;
      await aturWaktuSpk(no[nama]!, w);
    }
  });

  it('hanya SPK yang created_at-nya di tanggal WIB itu: 17:00:00.000Z hari sebelumnya ikut, 17:00:00.000Z hari itu tidak', async () => {
    expect((await nomorDaftar(b.kasir.token, { date: tgl, sort: 'oldest' }))).toEqual([no.awal, no.tengah, no.akhirHari]);
    expect(await nomorDaftar(b.kasir.token, { date: '2026-03-09' })).toEqual([no.sebelum]);
    expect(await nomorDaftar(b.kasir.token, { date: '2026-03-11' })).toEqual([no.sesudah]);
  });

  it('tanggal tanpa SPK → kosong; batas rentang 1000-01-02 dan 9999-12-31 sah', async () => {
    expect(await nomorDaftar(b.kasir.token, { date: '2026-03-12' })).toEqual([]);
    expect(await nomorDaftar(b.kasir.token, { date: '1000-01-02' })).toEqual([]);
    expect(await nomorDaftar(b.kasir.token, { date: '9999-12-31' })).toEqual([]);
  });
});

describe('GET /api/work-orders: pencarian nomor, plat, nama, dan nomor HP', () => {
  const no: Record<string, string> = {};

  beforeAll(async () => {
    await kosongkanSpkDanBooking();
    const siti = await buatPelangganDenganKendaraan(b.kasir.token, { name: 'Siti Rahmawati', phone: '0812-9999-0001' }, { plate: 'd 4321 abc' });
    const jose = await buatPelangganDenganKendaraan(b.kasir.token, { name: 'José Saragih', phone: '+62 857 1111 2222' }, { plate: 'AB-77-XY' });
    no.siti = (await buatSpk(b.kasir.token, siti.kendaraan.vehicleId)).number; // S-0001
    no.jose = (await buatSpk(b.kasir.token, jose.kendaraan.vehicleId)).number; // S-0002
  });

  it.each<[string, string, string[]]>([
    ['nomor persis', 'S-0001', ['siti']],
    ['nomor huruf kecil', 's-0002', ['jose']],
    ['bagian angka nomor', '0002', ['jose']],
    ['awalan nomor', 'S-000', ['siti', 'jose']],
    ['plat huruf kecil dengan spasi', 'd 4321', ['siti']],
    ['plat bagian tengah dengan tanda hubung', '4321-a', ['siti']],
    ['plat dengan titik', 'd.4321.abc', ['siti']],
    ['plat lain', 'ab77', ['jose']],
    ['nama sebagian, huruf kecil', 'rahma', ['siti']],
    ['nama tanpa aksen menemukan nama beraksen', 'JOSE', ['jose']],
    ['nama dipangkas', '  siti  ', ['siti']],
    ['tanda + di query berarti spasi', 'siti+rahma', ['siti']],
    ['HP bentuk 08 dengan tanda hubung', '0812-9999', ['siti']],
    ['HP bentuk +62 dengan spasi', '+62 857 1111', ['jose']],
    ['HP bentuk 62 utuh', '6285711112222', ['jose']],
    ['HP bagian tengah dengan spasi', '9999 0001', ['siti']],
    ['tidak cocok apa pun', 'tidakada', []],
    ['% dicocokkan apa adanya', '%', []],
    ['_ dicocokkan apa adanya', '_', []],
  ])('%s (%s)', async (_nama, search, harapan) => {
    // Tanda + ditulis langsung di path supaya tidak dikodekan menjadi %2B.
    const res = search.includes('+') && !search.startsWith('+')
      ? await api.get(`/api/work-orders?search=${search}`, { token: b.kasir.token })
      : await daftarSpk(b.kasir.token, { search });

    harapStatus(res, 200);
    expect(res.body.data.map((s: any) => s.number).sort()).toEqual(harapan.map((h) => no[h]).sort());
  });

  it('search kosong atau hanya spasi berarti tanpa filter', async () => {
    expect((await daftarSpk(b.kasir.token, { search: '' })).body.meta.total).toBe(2);
    expect((await daftarSpk(b.kasir.token, { search: '   ' })).body.meta.total).toBe(2);
  });

  it('term dengan byte UTF-8 tidak sah tidak pernah cocok: 200 daftar kosong', async () => {
    const res = await api.get('/api/work-orders?search=%FF', { token: b.kasir.token });

    expect(res.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it('search digabung dengan filter status', async () => {
    expect(await nomorDaftar(b.kasir.token, { search: 'S-000', status: 'QUEUED' })).toHaveLength(2);
    expect(await nomorDaftar(b.kasir.token, { search: 'S-000', status: 'DONE' })).toEqual([]);
  });
});

describe('GET /api/work-orders: pencarian memakai data pelanggan dan kendaraan saat ini', () => {
  it('nama dan plat yang diubah langsung dicari dengan nilai baru; nilai lama tidak lagi cocok', async () => {
    await kosongkanSpkDanBooking();
    const { pelanggan, kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token, { name: 'Rudi Hartono' }, { plate: 'F 5555 GH' });
    const n = (await buatSpk(b.kasir.token, kendaraan.vehicleId)).number;
    harapStatus(await api.patch(`/api/customers/${pelanggan.customerId}`, { token: b.kasir.token, json: { name: 'Rudi Wijaya' } }), 200);
    harapStatus(await api.patch(`/api/vehicles/${kendaraan.vehicleId}`, { token: b.kasir.token, json: { plate: 'F 6666 JK' } }), 200);

    expect(await nomorDaftar(b.kasir.token, { search: 'wijaya' })).toEqual([n]);
    expect(await nomorDaftar(b.kasir.token, { search: 'hartono' })).toEqual([]);
    expect(await nomorDaftar(b.kasir.token, { search: 'f6666' })).toEqual([n]);
    expect(await nomorDaftar(b.kasir.token, { search: 'f5555' })).toEqual([]);
  });

  it('kendaraan kedua pelanggan yang sama: pencarian nama menemukan SPK kedua kendaraannya', async () => {
    await kosongkanSpkDanBooking();
    const { pelanggan, kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token, { name: 'Wawan Setiawan' });
    const mobil = await tambahKendaraan(b.kasir.token, pelanggan.customerId, { type: 'CAR', brand: 'Toyota', model: 'Avanza' });
    const a = (await buatSpk(b.kasir.token, kendaraan.vehicleId)).number;
    const c = (await buatSpk(b.kasir.token, mobil.vehicleId)).number;

    expect((await nomorDaftar(b.kasir.token, { search: 'setiawan' })).sort()).toEqual([a, c].sort());
  });
});

describe('GET /api/work-orders: validasi query dan urutan 401 → 422', () => {
  it.each<[string, string, Record<string, string>]>([
    ['status kosong', 'status=', { status: 'invalid_format' }],
    ['status huruf kecil', 'status=queued', { status: 'invalid_format' }],
    ['status tak dikenal', 'status=SELESAI', { status: 'invalid_format' }],
    ['scope kosong', 'scope=', { scope: 'invalid_format' }],
    ['scope tak dikenal', 'scope=all', { scope: 'invalid_format' }],
    ['sort kosong', 'sort=', { sort: 'invalid_format' }],
    ['sort tak dikenal', 'sort=asc', { sort: 'invalid_format' }],
    ['mechanicId kosong', 'mechanicId=', { mechanicId: 'invalid_format' }],
    ['mechanicId huruf besar', 'mechanicId=AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE', { mechanicId: 'invalid_format' }],
    ['date kosong', 'date=', { date: 'invalid_format' }],
    ['date bentuk lain', 'date=2026-3-10', { date: 'invalid_format' }],
    ['date tidak ada di kalender', 'date=2026-02-30', { date: 'invalid_format' }],
    ['date sebelum 1000-01-02', 'date=1000-01-01', { date: 'invalid_format' }],
    ['page 0', 'page=0', { page: 'out_of_range' }],
    ['page bukan digit', 'page=-1', { page: 'invalid_format' }],
    ['limit 51', 'limit=51', { limit: 'out_of_range' }],
    ['limit kosong', 'limit=', { limit: 'invalid_format' }],
    ['titik koma adalah data biasa', 'limit=1;page=2', { limit: 'invalid_format' }],
    ['semua sekaligus', 'status=x&scope=x&sort=x&mechanicId=x&date=x&page=0&limit=0', {
      status: 'invalid_format',
      scope: 'invalid_format',
      sort: 'invalid_format',
      mechanicId: 'invalid_format',
      date: 'invalid_format',
      page: 'out_of_range',
      limit: 'out_of_range',
    }],
  ])('%s → 422', async (_nama, query, fields) => {
    harapGalat(await api.get(`/api/work-orders?${query}`, { token: b.kasir.token }), 422, 'validation_failed', fields);
  });

  it('tanpa token atau token tak dikenal → 401, lebih dulu dari query yang salah', async () => {
    harapGalat(await api.get('/api/work-orders?status=x'), 401, 'unauthenticated');
    harapGalat(await api.get('/api/work-orders', { token: tokenAcak() }), 401, 'unauthenticated');
  });
});
