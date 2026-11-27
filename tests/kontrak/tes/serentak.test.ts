// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Permintaan yang dikirim bersamaan (Promise.all). Hasilnya diperiksa sebagai
// himpunan, karena urutan tiba permintaan tidak menentukan siapa yang menang.
// Tiap describe menyiapkan datanya sendiri, sehingga urutan tes boleh diacak
// (blok setup mengosongkan database lebih dulu).

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  buatBookingPublik,
  buatKasir,
  buatPart,
  emailUnik,
  isianBooking,
  konfirmasiBooking,
  nomorUnik,
  SANDI_UJI,
  siapkanBengkel,
  spkBengkel,
  spkBerisi,
  ubahStatus,
  type Bengkel,
  type SesiStaf,
} from '../src/data';
import { aturPenghitung, barisKartuStok, barisPart, barisWaBooking, barisWaSpk, jumlahBaris, kosongkanDatabase, nilaiPenghitung, sparepartTidakCocokKartu } from '../src/db';
import { bacaEnv } from '../src/env';
import { nomorBooking, nomorSpk } from '../src/format';
import { harapGalat, harapStokKurang } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { waPalsu } from '../src/wa';
import { kirimBayar, nomorLokal, ringkasHasil, ringkasUangDb, TOTAL_BERISI, ulang } from './pembantu-uang';

const PUTARAN = 3;
const urutan = (nomor: string): number => Number(nomor.slice(2));
const deret = (awal: number, n: number): number[] => Array.from({ length: n }, (_, i) => awal + 1 + i);

afterEach(async () => {
  await waPalsu.gangguan({ gagal: false });
  await waPalsu.jeda(0);
});

describe.runIf(bacaEnv().setupToken !== '')('setup bersamaan', () => {
  beforeAll(async () => {
    await kosongkanDatabase();
  });

  it('delapan POST /api/setup bersamaan (email berbeda) → tepat satu 201 dan tujuh 409 already_set_up; satu pemilik dan satu sesi', async () => {
    const semua = await Promise.all(
      ulang(8, 0).map(() => api.post('/api/setup', { json: { token: bacaEnv().setupToken, name: 'Pemilik Bengkel', email: emailUnik('pemilik'), password: SANDI_UJI } })),
    );

    expect(ringkasHasil(semua)).toEqual(['201', ...ulang(7, '409:already_set_up')]);
    for (const r of semua.filter((x) => x.status === 409)) {
      harapGalat(r, 409, 'already_set_up');
    }
    expect(await jumlahBaris('staff')).toBe(1);
    expect(await jumlahBaris('staff', "role = 'owner' AND is_active = TRUE")).toBe(1);
    expect(await jumlahBaris('staff_sessions')).toBe(1);
    expect((await api.get('/api/setup')).body.data.needsSetup).toBe(false);
  });
});

describe('nomor SPK: unik, berurutan, tanpa celah', () => {
  let b: Bengkel;

  beforeAll(async () => {
    b = await siapkanBengkel();
  });

  const buat = (token: string) => api.post('/api/work-orders', { token, json: { vehicleId: b.kendaraan.vehicleId, complaint: 'Servis.' } });

  it('sepuluh SPK bersamaan dari kasir dan pemilik: semua 201, nomor berurutan tanpa celah, token lacak dan linimasa satu per SPK', async () => {
    for (let putaran = 0; putaran < PUTARAN; putaran += 1) {
      const awal = await nilaiPenghitung('work_order_number');
      const log = await jumlahBaris('work_order_status_logs');

      const semua = await Promise.all(ulang(10, 0).map((_, i) => buat(i % 2 ? b.pemilik.token : b.kasir.token)));

      expect(ringkasHasil(semua), `putaran ${putaran}`).toEqual(ulang(10, '201'));
      const nomor = semua.map((r) => r.body.data.number as string);
      expect(nomor.map(urutan).sort((x, y) => x - y)).toEqual(deret(awal, 10));
      for (const n of nomor) {
        expect(n).toBe(nomorSpk(urutan(n)));
      }
      expect(await nilaiPenghitung('work_order_number')).toBe(awal + 10);
      expect(new Set(semua.map((r) => r.body.data.trackingToken)).size).toBe(10);
      expect(await jumlahBaris('work_order_status_logs')).toBe(log + 10);
    }
  });

  it('SPK baru bersamaan dengan booking yang dijadikan SPK memakai satu penghitung: nomor tetap tanpa celah, nomor booking tidak bergeser', async () => {
    const booking = [];
    for (let i = 0; i < 4; i += 1) {
      booking.push(await buatBookingPublik());
    }
    const awal = await nilaiPenghitung('work_order_number');
    const awalBooking = await nilaiPenghitung('booking_number');

    const semua = await Promise.all([
      ...booking.map((x) => api.post(`/api/bookings/${x.bookingId}/convert`, { token: b.kasir.token, json: {} })),
      ...ulang(4, 0).map(() => buat(b.pemilik.token)),
    ]);

    expect(ringkasHasil(semua)).toEqual(ulang(8, '201'));
    const nomor = semua.map((r) => (r.body.data.workOrder?.number ?? r.body.data.number) as string);
    expect(nomor.map(urutan).sort((x, y) => x - y)).toEqual(deret(awal, 8));
    expect(await nilaiPenghitung('booking_number')).toBe(awalBooking);
  });

  it('melewati S-9999 bersamaan: S-9998, S-9999, S-10000, S-10001 tanpa celah', async () => {
    await aturPenghitung('work_order_number', 9997);

    const semua = await Promise.all(ulang(4, 0).map(() => buat(b.kasir.token)));

    expect(ringkasHasil(semua)).toEqual(ulang(4, '201'));
    expect(semua.map((r) => r.body.data.number).sort()).toEqual(['S-10000', 'S-10001', 'S-9998', 'S-9999']);
  });
});

describe('nomor booking: unik, berurutan, tanpa celah', () => {
  it('sepuluh booking publik bersamaan (nomor HP berbeda): semua 201, nomor berurutan tanpa celah, token booking berbeda', async () => {
    for (let putaran = 0; putaran < PUTARAN; putaran += 1) {
      const awal = await nilaiPenghitung('booking_number');
      const isian = [];
      for (let i = 0; i < 10; i += 1) {
        isian.push(await isianBooking());
      }

      const semua = await Promise.all(isian.map((json) => api.post('/api/public/bookings', { json })));

      expect(ringkasHasil(semua), `putaran ${putaran}`).toEqual(ulang(10, '201'));
      const nomor = semua.map((r) => r.body.data.booking.number as string);
      expect(nomor.map(urutan).sort((x, y) => x - y)).toEqual(deret(awal, 10));
      for (const n of nomor) {
        expect(n).toBe(nomorBooking(urutan(n)));
      }
      expect(await nilaiPenghitung('booking_number')).toBe(awal + 10);
      expect(new Set(semua.map((r) => r.body.data.bookingToken)).size).toBe(10);
    }
  });
});

describe('batas 3 booking menunggu per nomor HP saat bersamaan', () => {
  const menunggu = (nomor: string) => jumlahBaris('bookings', "customer_phone = ? AND status = 'PENDING'", [nomor]);

  it('enam booking bersamaan untuk satu nomor (dalam berbagai bentuk) → tepat tiga 201 dan tiga 409; nomor booking yang ditolak tidak terpakai', async () => {
    for (let putaran = 0; putaran < PUTARAN; putaran += 1) {
      const nomor = nomorUnik();
      const bentuk = [nomor, nomorLokal(nomor), `+${nomor}`, `${nomorLokal(nomor).slice(0, 4)}-${nomorLokal(nomor).slice(4)}`, nomor, nomorLokal(nomor)];
      const isian = [];
      for (const phone of bentuk) {
        isian.push(await isianBooking({ phone }));
      }
      const awal = await nilaiPenghitung('booking_number');

      const semua = await Promise.all(isian.map((json) => api.post('/api/public/bookings', { json })));

      expect(ringkasHasil(semua), `putaran ${putaran}`).toEqual([...ulang(3, '201'), ...ulang(3, '409:too_many_pending_bookings')]);
      for (const r of semua.filter((x) => x.status === 409)) {
        harapGalat(r, 409, 'too_many_pending_bookings');
      }
      expect(await menunggu(nomor)).toBe(3);
      const nomorDipakai = semua.filter((r) => r.status === 201).map((r) => urutan(r.body.data.booking.number));
      expect(nomorDipakai.sort((x, y) => x - y)).toEqual(deret(awal, 3));
      expect(await nilaiPenghitung('booking_number')).toBe(awal + 3);
    }
  });

  it('nomor yang sudah punya satu booking menunggu dan satu dikonfirmasi: lima bersamaan → dua 201; nomor lain bersamaan tidak terpengaruh', async () => {
    const b = await siapkanBengkel();
    const nomor = nomorUnik();
    await buatBookingPublik({ phone: nomor });
    await konfirmasiBooking(b.kasir.token, (await buatBookingPublik({ phone: nomor })).bookingId);
    const isian = [];
    for (let i = 0; i < 5; i += 1) {
      isian.push(await isianBooking({ phone: nomor }));
    }
    for (let i = 0; i < 3; i += 1) {
      isian.push(await isianBooking());
    }
    const awal = await nilaiPenghitung('booking_number');

    const semua = await Promise.all(isian.map((json) => api.post('/api/public/bookings', { json })));

    expect(ringkasHasil(semua.slice(0, 5))).toEqual([...ulang(2, '201'), ...ulang(3, '409:too_many_pending_bookings')]);
    expect(ringkasHasil(semua.slice(5))).toEqual(ulang(3, '201'));
    expect(await menunggu(nomor)).toBe(3);
    expect(await nilaiPenghitung('booking_number')).toBe(awal + 5);
  });
});

describe('stok terakhir dipakai beberapa kasir bersamaan', () => {
  let b: Bengkel;
  let kasirLain: SesiStaf;

  beforeAll(async () => {
    b = await siapkanBengkel();
    kasirLain = await buatKasir({ name: 'Kasir Sore' });
  });

  const tambah = (token: string, nomor: string, partId: string, quantity: number): Promise<Respons> =>
    api.post(`/api/work-orders/${nomor}/items`, { token, json: { type: 'PART', partId, quantity } });

  it('stok 1, dua kasir menambahkannya ke dua SPK bersamaan → tepat satu 201 dan satu 409 insufficient_stock; stok 0, satu kartu USED', async () => {
    for (let putaran = 0; putaran < PUTARAN; putaran += 1) {
      const part = await buatPart(b.pemilik.token, { unit: 'set', initialStock: 1 });
      const [s1, s2] = [await spkBengkel(b), await spkBengkel(b)];

      const semua = await Promise.all([tambah(b.kasir.token, s1.number, part.partId, 1), tambah(kasirLain.token, s2.number, part.partId, 1)]);

      expect(ringkasHasil(semua), `putaran ${putaran}`).toEqual(['201', '409:insufficient_stock']);
      harapStokKurang(semua.find((r) => r.status === 409)!, { name: part.name, unit: 'set', butuh: 1, tersedia: 0 });
      expect((await barisPart(part.partId)).stock).toBe(0);
      expect((await barisKartuStok(part.partId)).map((k) => [k.type, k.quantity, k.stock_after])).toEqual([
        ['IN', 1, 1],
        ['USED', -1, 0],
      ]);
    }
    expect(await sparepartTidakCocokKartu()).toEqual([]);
  });

  it('stok 3, enam kasir menambahkan 1 bersamaan → tepat tiga 201; stok tidak pernah negatif', async () => {
    const part = await buatPart(b.pemilik.token, { initialStock: 3 });
    const spk = [];
    for (let i = 0; i < 6; i += 1) {
      spk.push(await spkBengkel(b));
    }

    const semua = await Promise.all(spk.map((s, i) => tambah(i % 2 ? kasirLain.token : b.kasir.token, s.number, part.partId, 1)));

    expect(ringkasHasil(semua)).toEqual([...ulang(3, '201'), ...ulang(3, '409:insufficient_stock')]);
    expect((await barisPart(part.partId)).stock).toBe(0);
    expect((await barisKartuStok(part.partId)).filter((k) => k.type === 'USED')).toHaveLength(3);
    expect(await sparepartTidakCocokKartu()).toEqual([]);
  });

  it('stok 3, dua item berjumlah 2 ke SPK yang sama bersamaan → satu 201, yang lain 409 dengan stok sesudah yang pertama (tersedia 1)', async () => {
    const part = await buatPart(b.pemilik.token, { unit: 'botol', initialStock: 3 });
    const spk = await spkBengkel(b);

    const semua = await Promise.all([tambah(b.kasir.token, spk.number, part.partId, 2), tambah(kasirLain.token, spk.number, part.partId, 2)]);

    expect(ringkasHasil(semua)).toEqual(['201', '409:insufficient_stock']);
    harapStokKurang(semua.find((r) => r.status === 409)!, { name: part.name, unit: 'botol', butuh: 2, tersedia: 1 });
    expect((await barisPart(part.partId)).stock).toBe(1);
  });

  it('stok 1: item SPK bersamaan dengan stok keluar manual pemilik → tepat satu berhasil', async () => {
    for (let putaran = 0; putaran < PUTARAN; putaran += 1) {
      const part = await buatPart(b.pemilik.token, { initialStock: 1 });
      const spk = await spkBengkel(b);

      const semua = await Promise.all([
        tambah(b.kasir.token, spk.number, part.partId, 1),
        api.post(`/api/parts/${part.partId}/stock-out`, { token: b.pemilik.token, json: { quantity: 1, note: 'Rusak' } }),
      ]);

      expect(ringkasHasil(semua).filter((s) => s === '409:insufficient_stock'), `putaran ${putaran}`).toHaveLength(1);
      expect(semua.filter((r) => r.status === 200 || r.status === 201)).toHaveLength(1);
      expect((await barisPart(part.partId)).stock).toBe(0);
    }
    expect(await sparepartTidakCocokKartu()).toEqual([]);
  });
});

describe('pembayaran bersamaan tidak pernah melebihi total', () => {
  let b: Bengkel;
  let kasirLain: SesiStaf;

  beforeAll(async () => {
    b = await siapkanBengkel();
    kasirLain = await buatKasir({ name: 'Kasir Sore' });
  });

  it('dua pembayaran yang masing-masing sebesar sisa tagihan → tepat satu 201 dan satu 422 amount out_of_range', async () => {
    for (let putaran = 0; putaran < PUTARAN; putaran += 1) {
      const spk = await spkBerisi(b);

      const semua = await Promise.all([
        kirimBayar(b.kasir.token, spk.number, { amount: TOTAL_BERISI, method: 'cash' }),
        kirimBayar(kasirLain.token, spk.number, { amount: TOTAL_BERISI, method: 'qris' }),
      ]);

      expect(ringkasHasil(semua), `putaran ${putaran}`).toEqual(['201', '422:validation_failed']);
      harapGalat(semua.find((r) => r.status === 422)!, 422, 'validation_failed', { amount: 'out_of_range' });
      expect(await ringkasUangDb(spk.number)).toEqual({ paid: TOTAL_BERISI, jumlah: TOTAL_BERISI, baris: 1 });
    }
  });

  it('sepuluh pembayaran Rp10.000 bersamaan dari tiga staf ke SPK Rp90.000 → tepat sembilan 201; paidAmount = jumlah pembayaran', async () => {
    const spk = await spkBerisi(b);
    const token = [b.kasir.token, b.pemilik.token, kasirLain.token];

    const semua = await Promise.all(ulang(10, 0).map((_, i) => kirimBayar(token[i % 3], spk.number, { amount: 10_000, method: 'cash' })));

    expect(ringkasHasil(semua)).toEqual([...ulang(9, '201'), '422:validation_failed']);
    expect(await ringkasUangDb(spk.number)).toEqual({ paid: TOTAL_BERISI, jumlah: TOTAL_BERISI, baris: 9 });
  });
});

describe('perubahan status dan booking yang sama bersamaan: tepat satu pemenang', () => {
  let b: Bengkel;

  beforeAll(async () => {
    b = await siapkanBengkel();
  });

  it('dua permintaan DONE bersamaan → satu 200 dan satu 409 status_transition_invalid; pesan work_order_done hanya sekali', async () => {
    const spk = await spkBerisi(b);
    await ubahStatus(b.kasir.token, spk.number, 'IN_PROGRESS');

    const semua = await Promise.all([b.kasir.token, b.pemilik.token].map((token) => api.post(`/api/work-orders/${spk.number}/status`, { token, json: { status: 'DONE' } })));

    expect(ringkasHasil(semua)).toEqual(['200', '409:status_transition_invalid']);
    expect(await barisWaSpk(spk.number, 'work_order_done')).toHaveLength(1);
    expect(await jumlahBaris('work_order_status_logs', "to_status = 'DONE' AND work_order_id = (SELECT work_order_id FROM work_orders WHERE number = ?)", [spk.number])).toBe(1);
  });

  it('dua konfirmasi bersamaan → satu 200 dan satu 409 booking_transition_invalid; pesan booking_confirmed hanya sekali', async () => {
    const { bookingId, booking } = await buatBookingPublik();

    const semua = await Promise.all([b.kasir.token, b.pemilik.token].map((token) => api.post(`/api/bookings/${bookingId}/confirm`, { token })));

    expect(ringkasHasil(semua)).toEqual(['200', '409:booking_transition_invalid']);
    expect(await barisWaBooking(booking.number, 'booking_confirmed')).toHaveLength(1);
  });

  it('pelanggan membatalkan bersamaan dengan kasir menjadikannya SPK → tepat satu berhasil, yang kalah 409 booking_transition_invalid', async () => {
    for (let putaran = 0; putaran < PUTARAN; putaran += 1) {
      const { bookingId, bookingToken } = await buatBookingPublik();
      const awal = await jumlahBaris('work_orders');

      const semua = await Promise.all([
        api.post(`/api/public/bookings/${bookingToken}/cancel`),
        api.post(`/api/bookings/${bookingId}/convert`, { token: b.kasir.token, json: {} }),
      ]);

      const hasil = ringkasHasil(semua);
      expect(hasil.filter((s) => s === '409:booking_transition_invalid'), `putaran ${putaran}`).toHaveLength(1);
      expect(hasil.filter((s) => s === '200' || s === '201')).toHaveLength(1);
      expect(await jumlahBaris('work_orders')).toBe(awal + (semua[1]!.status === 201 ? 1 : 0));
    }
  });

  it('item ditambahkan bersamaan dengan DONE: item masuk sebelum DONE (201) atau ditolak work_order_locked, dan nilai SPK sesuai pemenangnya', async () => {
    const spk = await spkBerisi(b);
    await ubahStatus(b.kasir.token, spk.number, 'IN_PROGRESS');

    const [item, selesai] = await Promise.all([
      api.post(`/api/work-orders/${spk.number}/items`, { token: b.kasir.token, json: { type: 'SERVICE', serviceId: b.cekKelistrikan.serviceId, quantity: 1 } }),
      api.post(`/api/work-orders/${spk.number}/status`, { token: b.pemilik.token, json: { status: 'DONE' } }),
    ]);

    expect(selesai!.status).toBe(200);
    expect([201, 409]).toContain(item!.status);
    if (item!.status === 409) {
      harapGalat(item!, 409, 'work_order_locked');
    }
    const detail = (await api.get(`/api/work-orders/${spk.number}`, { token: b.kasir.token })).body.data;
    expect(detail.total).toBe(item!.status === 201 ? TOTAL_BERISI + 50_000 : TOTAL_BERISI);
  });
});
