// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// GET /api/public/work-orders/{trackingToken} (halaman lacak sekaligus nota
// online) dan POST /api/work-orders/{number}/tracking-link (buat ulang tautan
// lacak, mematikan token lama). Respons publik sesuai skema SpkPublik: nomor
// HP tersamar, tanpa ID, data staf, nama mekanik, diagnosis, catatan
// linimasa, pembayaran per baris, status WhatsApp, token, maupun harga beli.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import {
  aturOutlet,
  bayar,
  buatBookingPublik,
  buatPelangganDenganKendaraan,
  buatSpk,
  buatUlangTautan,
  detailSpk,
  lacakPublik,
  nomorUnik,
  siapkanBengkel,
  spkBerisi,
  ubahStatus,
  wajib,
  type Bengkel,
} from '../src/data';
import { barisLogSpk, barisSpk, barisWaSpk } from '../src/db';
import { samarkanHp } from '../src/format';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { waPalsu } from '../src/wa';
import { jsonLebihDariSatuMib, JSON_RUSAK, tokenAcak, tukarHuruf } from './pembantu-fondasi';
import { isiSpk, keStatus, nomorPanjang, profilOutlet, SEMUA_STATUS, semuaKunci, type StatusSpk } from './pembantu-uang';

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
});

const lacak = (token: string) => api.get(`/api/public/work-orders/${token}`);
const buatUlang = (token: string | undefined, nomor: string, opsi: { mentah?: string } = {}) =>
  api.post(`/api/work-orders/${nomor}/tracking-link`, { token, ...opsi });

// SpkPublik yang diharapkan, diturunkan dari rincian staf (SpkDetail) dan
// profil outlet pada saat yang sama.
async function publikDari(d: any): Promise<unknown> {
  return {
    outlet: await profilOutlet(),
    number: d.number,
    status: d.status,
    paymentStatus: d.paymentStatus,
    customerName: d.customer.name,
    customerPhone: samarkanHp(d.customer.phone),
    vehicle: { type: d.vehicle.type, plate: d.vehicle.plate, brand: d.vehicle.brand, model: d.vehicle.model },
    complaint: d.complaint,
    estimatedDoneAt: d.estimatedDoneAt,
    serviceSubtotal: d.serviceSubtotal,
    partSubtotal: d.partSubtotal,
    total: d.total,
    paidAmount: d.paidAmount,
    remainingAmount: d.remainingAmount,
    cancelReason: d.cancelReason,
    createdAt: d.createdAt,
    items: d.items.map((i: any) => ({ type: i.type, name: i.name, price: i.price, quantity: i.quantity, subtotal: i.subtotal })),
    timeline: d.timeline.map((l: any) => ({ fromStatus: l.fromStatus, toStatus: l.toStatus, createdAt: l.createdAt })),
  };
}

const KUNCI_TERLARANG = ['costPrice', 'diagnosis', 'mechanic', 'note', 'by', 'recordedBy', 'createdBy', 'payments', 'wa', 'trackingToken', 'customer', 'booking', 'odometer'];

describe('GET /api/public/work-orders/{trackingToken}: isi respons', () => {
  it('sama dengan rincian staf yang disaring: HP tersamar, tanpa mekanik, diagnosis, catatan, data staf, pembayaran per baris, dan token', async () => {
    await aturOutlet(b.pemilik.token, { name: 'Bengkel Maju Jaya', receiptFooter: 'Garansi servis 7 hari.' });
    const spk = await spkBerisi(b, { denganMekanik: true });
    await ubahStatus(b.mekanik.token, spk.number, 'IN_PROGRESS', 'Catatan internal mekanik ABC.');
    wajib(await api.patch(`/api/work-orders/${spk.number}`, { token: b.mekanik.token, json: { diagnosis: 'Diagnosis rahasia XYZ.' } }), 200);
    wajib(await api.patch(`/api/work-orders/${spk.number}`, { token: b.kasir.token, json: { estimatedDoneAt: '2026-11-28T08:00:00.000Z' } }), 200);
    await bayar(b.kasir.token, spk.number, 20_000, 'qris');
    const detail = await detailSpk(b.kasir.token, spk.number);

    const res = await lacak(spk.trackingToken);

    harapStatus(res, 200);
    harapSetara(res.body.data, await publikDari(detail));
    expect(res.body.data.customerPhone).toBe(samarkanHp(b.pelanggan.phone));
    const kunci = semuaKunci(res.body.data);
    for (const k of KUNCI_TERLARANG) {
      expect(kunci.has(k), `kunci ${k} tidak boleh ada`).toBe(false);
    }
    expect([...kunci].filter((k) => /Id$/.test(k))).toEqual([]);
    for (const teks of [b.mekanik.staff.name, b.kasir.staff.name, 'Diagnosis rahasia XYZ.', 'Catatan internal mekanik ABC.', b.pelanggan.phone, spk.trackingToken]) {
      expect(res.teks).not.toContain(teks);
    }
  });

  it.each<[string, number]>([
    ['10 digit', 10],
    ['13 digit', 13],
    ['15 digit', 15],
  ])('nomor HP %s disamarkan menjadi 4 digit pertama, ****, dan 4 digit terakhir', async (_nama, digit) => {
    const nomor = nomorPanjang(digit);
    const { kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token, { phone: nomor });
    const spk = await buatSpk(b.kasir.token, kendaraan.vehicleId);

    const data = await lacakPublik(spk.trackingToken);

    expect(data.customerPhone).toBe(`${nomor.slice(0, 4)}****${nomor.slice(-4)}`);
    expect(data.customerPhone).toMatch(/^628[0-9][*]{4}[0-9]{4}$/);
  });

  it('SPK tanpa item: daftar item kosong, uang 0, status bayar paid, linimasa satu baris', async () => {
    const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);

    const data = await lacakPublik(spk.trackingToken);

    expect(data).toMatchObject({ items: [], total: 0, paidAmount: 0, remainingAmount: 0, paymentStatus: 'paid', status: 'QUEUED', cancelReason: null });
    expect(data.timeline).toHaveLength(1);
    expect(data.timeline[0]).toMatchObject({ fromStatus: null, toStatus: 'QUEUED' });
  });

  it('SPK CANCELLED tetap bisa dilihat, dengan alasan batal (satu-satunya teks staf yang tampil)', async () => {
    const spk = await keStatus(b, await spkBerisi(b), 'CANCELLED');

    const res = await lacak(spk.trackingToken);

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: 'Pelanggan memutuskan servis di lain hari.' });
    expect(res.body.data.timeline.at(-1)).toEqual({ fromStatus: 'QUEUED', toStatus: 'CANCELLED', createdAt: expect.any(String) });
    harapSetara(res.body.data, await publikDari(await detailSpk(b.kasir.token, spk.number)));
  });

  it('halaman lacak selalu menampilkan keadaan terbaru (dimuat ulang berkala)', async () => {
    const spk = await spkBerisi(b);
    expect((await lacakPublik(spk.trackingToken)).status).toBe('QUEUED');

    await ubahStatus(b.kasir.token, spk.number, 'IN_PROGRESS');
    await ubahStatus(b.kasir.token, spk.number, 'DONE');
    await bayar(b.kasir.token, spk.number, 90_000);

    const data = await lacakPublik(spk.trackingToken);
    expect(data).toMatchObject({ status: 'DONE', paymentStatus: 'paid', paidAmount: 90_000, remainingAmount: 0 });
    expect(data.timeline.map((l: any) => l.toStatus)).toEqual(['QUEUED', 'IN_PROGRESS', 'DONE']);
  });

  it('nama, nomor HP, dan kendaraan adalah data saat ini: perubahan pelanggan dan kendaraan sesudah SPK dibuat langsung tampil', async () => {
    const { pelanggan, kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token);
    const spk = await buatSpk(b.kasir.token, kendaraan.vehicleId);
    const nomorBaru = nomorUnik();

    wajib(await api.patch(`/api/customers/${pelanggan.customerId}`, { token: b.kasir.token, json: { name: 'Nama Baru Pelanggan', phone: nomorBaru } }), 200);
    wajib(await api.patch(`/api/vehicles/${kendaraan.vehicleId}`, { token: b.kasir.token, json: { type: 'CAR', plate: 'f 77 zz', brand: 'Toyota', model: '' } }), 200);

    const data = await lacakPublik(spk.trackingToken);
    expect(data).toMatchObject({ customerName: 'Nama Baru Pelanggan', customerPhone: samarkanHp(nomorBaru) });
    expect(data.vehicle).toEqual({ type: 'CAR', plate: 'F 77 ZZ', brand: 'Toyota', model: '' });
    harapSetara(data, await publikDari(await detailSpk(b.kasir.token, spk.number)));
  });

  it('header Authorization apa pun diabaikan (rute publik)', async () => {
    const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);

    for (const nilai of ['Bearer sampah', `Bearer ${tokenAcak()}`, `Bearer ${b.kasir.token}`]) {
      harapStatus(await api.get(`/api/public/work-orders/${spk.trackingToken}`, { header: { Authorization: nilai } }), 200);
    }
  });
});

describe('GET /api/public/work-orders/{trackingToken}: token tak dikenal atau berbentuk lain → 404', () => {
  let token: string;

  beforeAll(async () => {
    token = (await buatSpk(b.kasir.token, b.kendaraan.vehicleId)).trackingToken;
  });

  it('token sah yang tidak pernah diterbitkan → 404 not_found', async () => {
    harapGalat(await lacak(tokenAcak()), 404, 'not_found');
  });

  it('token booking yang sah tidak membuka SPK → 404', async () => {
    const { bookingToken } = await buatBookingPublik();

    harapGalat(await lacak(bookingToken), 404, 'not_found');
  });

  it('huruf besar dan kecil ditukar (token peka huruf) → 404', async () => {
    const tukar = tukarHuruf(token);
    if (tukar !== undefined) {
      harapGalat(await lacak(tukar), 404, 'not_found');
    }
  });

  it.each<[string, (t: string) => string]>([
    ['42 karakter', (t) => t.slice(0, 42)],
    ['44 karakter', (t) => `${t}A`],
    ['berpadding =', (t) => `${t}=`],
    ['memuat +', (t) => `${t.slice(0, 42)}+`],
    ['memuat titik', (t) => `${t.slice(0, 42)}.`],
    ['memuat spasi (%20)', (t) => `${t.slice(0, 42)}%20`],
    ['memuat ~', (t) => `${t.slice(0, 42)}~`],
  ])('token %s → 404', async (_nama, ubah) => {
    harapGalat(await lacak(ubah(token)), 404, 'not_found');
  });
});

describe('POST /api/work-orders/{number}/tracking-link: membuat ulang tautan lacak', () => {
  it('token baru menggantikan yang lama: token lama langsung 404, token baru membuka SPK yang sama, tersimpan apa adanya', async () => {
    const spk = await spkBerisi(b);
    const lama = spk.trackingToken;
    const log = (await barisLogSpk(spk.number)).length;
    const pesan = (await waPalsu.untuk(b.pelanggan.phone)).length;
    const baris = (await barisWaSpk(spk.number)).length;

    const res = await buatUlang(b.kasir.token, spk.number);

    harapStatus(res, 200);
    const baru = res.body.data.trackingToken;
    expect(baru).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(baru).not.toBe(lama);
    harapGalat(await lacak(lama), 404, 'not_found');
    expect((await lacakPublik(baru)).number).toBe(spk.number);
    expect((await detailSpk(b.kasir.token, spk.number)).trackingToken).toBe(baru);
    expect((await barisSpk(spk.number)).tracking_token).toBe(baru);
    expect(res.body.data).toMatchObject({ number: spk.number, status: spk.status, total: spk.total });
    expect(await barisLogSpk(spk.number)).toHaveLength(log);
    expect(await waPalsu.untuk(b.pelanggan.phone)).toHaveLength(pesan);
    expect(await barisWaSpk(spk.number)).toHaveLength(baris);
  });

  it('dibuat ulang dua kali: hanya token terakhir yang hidup', async () => {
    const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);

    const satu = (await buatUlangTautan(b.kasir.token, spk.number)).trackingToken;
    const dua = (await buatUlangTautan(b.pemilik.token, spk.number)).trackingToken;

    expect(new Set([spk.trackingToken, satu, dua]).size).toBe(3);
    harapGalat(await lacak(spk.trackingToken), 404, 'not_found');
    harapGalat(await lacak(satu), 404, 'not_found');
    harapStatus(await lacak(dua), 200);
  });

  it.each(SEMUA_STATUS)('boleh di status %s', async (status: StatusSpk) => {
    const spk = await keStatus(b, await isiSpk(b, (await buatSpk(b.kasir.token, b.kendaraan.vehicleId)).number), status);

    const baru = await buatUlangTautan(b.kasir.token, spk.number);

    expect(baru.status).toBe(status);
    harapGalat(await lacak(spk.trackingToken), 404, 'not_found');
    expect((await lacakPublik(baru.trackingToken)).status).toBe(status);
  });

  it('tanpa badan: badan apa pun diabaikan, termasuk JSON rusak dan badan lebih dari 1 MiB', async () => {
    const spk = await buatSpk(b.kasir.token, b.kendaraan.vehicleId);

    harapStatus(await buatUlang(b.kasir.token, spk.number, { mentah: JSON_RUSAK }), 200);
    harapStatus(await buatUlang(b.kasir.token, spk.number, { mentah: jsonLebihDariSatuMib() }), 200);
  });

  it('urutan 401 → 403 → 404: tanpa token 401, mekanik 403 (juga SPK miliknya dan nomor yang tidak ada), nomor tidak ada 404', async () => {
    const milik = await buatSpk(b.kasir.token, b.kendaraan.vehicleId, { mechanicId: b.mekanik.staff.staffId });

    harapGalat(await buatUlang(undefined, 'S-9999'), 401, 'unauthenticated');
    harapGalat(await buatUlang(b.mekanik.token, milik.number), 403, 'forbidden');
    harapGalat(await buatUlang(b.mekanik.token, 'S-9999'), 403, 'forbidden');
    harapGalat(await buatUlang(b.kasir.token, 'S-9999'), 404, 'not_found');
    harapGalat(await buatUlang(b.kasir.token, milik.number.toLowerCase()), 404, 'not_found');
    expect((await barisSpk(milik.number)).tracking_token).toBe(milik.trackingToken);
    harapStatus(await lacak(milik.trackingToken), 200);
  });
});
