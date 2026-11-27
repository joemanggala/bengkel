// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// POST /api/work-orders/{number}/wa: kasir mengirim ulang work_order_created,
// work_order_done, atau receipt. Isi pesan dibandingkan huruf demi huruf
// dengan src/format.ts memakai data saat pesan dikirim (whatsapp.md bagian 3
// dan 5). Kegagalan penyedia → 503 wa_unavailable dengan baris failed.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { aturOutlet, bayar, buatUlangTautan, detailSpk, kirimWa, nomorUnik, siapkanBengkel, wajib, type Bengkel } from '../src/data';
import { barisSpk, barisWaSpk, idSpk, jalankan, type BarisWa, type JenisWa } from '../src/db';
import { bacaEnv } from '../src/env';
import { pesanNota, pesanSiapDiambil, pesanSpkDibuat } from '../src/format';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { waPalsu, type ModeGangguanWa } from '../src/wa';
import { jsonLebihDariSatuMib, JSON_RUSAK } from './pembantu-fondasi';
import { keStatus, kirimBayar, kirimWaSpk, nomorLokal, profilOutlet, selisihSekarangMs, spkPelangganBaru, tautanSpk, type StatusSpk } from './pembantu-uang';

type JenisSpk = 'work_order_created' | 'work_order_done' | 'receipt';

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
  await aturOutlet(b.pemilik.token, {
    name: 'Bengkel Maju Jaya',
    address: 'Jl. Merdeka No. 10, Bandung',
    openingHours: 'Senin–Sabtu 08.00–17.00',
    receiptFooter: 'Garansi servis 7 hari.\nTerima kasih.',
  });
});

afterEach(async () => {
  await waPalsu.gangguan({ gagal: false });
  await waPalsu.jeda(0);
});

// Pesan yang diharapkan untuk `detail` (SpkDetail saat pesan dikirim) dengan
// profil outlet saat ini.
async function harapan(jenis: JenisSpk, detail: any): Promise<string> {
  const outlet = await profilOutlet();
  const tautan = tautanSpk(detail);
  if (jenis === 'receipt') {
    return pesanNota(outlet, detail, tautan);
  }
  return jenis === 'work_order_done' ? pesanSiapDiambil(outlet, detail, tautan) : pesanSpkDibuat(outlet, detail, tautan);
}

// SPK berisi Rp90.000 untuk pelanggan bernomor unik, dibawa ke `status`.
async function spkDi(status: StatusSpk = 'QUEUED', isi = true): Promise<{ nomorHp: string; spk: any }> {
  const x = await spkPelangganBaru(b, { isi });
  return { nomorHp: x.nomorHp, spk: status === 'QUEUED' ? x.spk : await keStatus(b, x.spk, status) };
}

const jumlahPesan = async (nomor: string): Promise<number> => (await waPalsu.untuk(nomor)).length;

describe('POST /api/work-orders/{number}/wa {"type": "receipt"}', () => {
  it('200: nota sesuai templat dikirim ke nomor pelanggan, dicatat di wa_messages, wa.receipt sent', async () => {
    const { nomorHp, spk } = await spkDi();
    await bayar(b.kasir.token, spk.number, 50_000);

    const res = await kirimWaSpk(b.kasir.token, spk.number, { type: 'receipt' });

    harapStatus(res, 200);
    const pesan = await harapan('receipt', res.body.data);
    expect(pesan).toContain('Garansi servis 7 hari.\nTerima kasih.');
    expect((await waPalsu.terakhir(nomorHp)).pesan).toBe(pesan);
    expect(res.body.data.wa).toMatchObject({ workOrderCreated: { status: 'sent' }, workOrderDone: null, receipt: { status: 'sent' } });
    expect(selisihSekarangMs(res.body.data.wa.receipt.createdAt)).toBeLessThan(60_000);
    expect(await barisWaSpk(spk.number, 'receipt')).toMatchObject([
      { type: 'receipt', phone: nomorHp, body: pesan, status: 'sent', failure_reason: null, booking_id: null, work_order_id: await idSpk(spk.number) },
    ]);
  });

  it.each<StatusSpk>(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP'])('nota boleh diminta di status %s; baris Status memakai label status', async (status) => {
    const { nomorHp, spk } = await spkDi(status);

    const detail = await kirimWa(b.kasir.token, spk.number, 'receipt');

    expect(detail).toMatchObject({ status, wa: { receipt: { status: 'sent' } } });
    expect((await waPalsu.terakhir(nomorHp)).pesan).toBe(await harapan('receipt', detail));
  });

  it('SPK tanpa item: blok item berisi "Belum ada item." dan semua uang Rp0', async () => {
    const { nomorHp, spk } = await spkDi('QUEUED', false);

    const detail = await kirimWa(b.kasir.token, spk.number, 'receipt');

    const pesan = (await waPalsu.terakhir(nomorHp)).pesan;
    expect(pesan).toBe(await harapan('receipt', detail));
    expect(pesan).toContain('\n\nBelum ada item.\n\n');
  });

  it('kaki nota, alamat, dan jam buka kosong: blok opsional hilang tanpa baris kosong berlebih', async () => {
    const asal = await profilOutlet();
    await aturOutlet(b.pemilik.token, { receiptFooter: '', openingHours: '', address: '' });
    try {
      const { nomorHp, spk } = await spkDi('DONE');

      const nota = await kirimWa(b.kasir.token, spk.number, 'receipt');
      const isiNota = (await waPalsu.terakhir(nomorHp)).pesan;
      const siap = await kirimWa(b.kasir.token, spk.number, 'work_order_done');
      const isiSiap = (await waPalsu.terakhir(nomorHp)).pesan;

      expect(isiNota).toBe(await harapan('receipt', nota));
      expect(isiSiap).toBe(await harapan('work_order_done', siap));
      for (const isi of [isiNota, isiSiap]) {
        expect(isi).not.toMatch(/\n\n\n|\n$| \n/);
        expect(isi.endsWith(tautanSpk(spk))).toBe(true);
      }
    } finally {
      await aturOutlet(b.pemilik.token, asal);
    }
  });
});

describe('POST /api/work-orders/{number}/wa {"type": "work_order_created" | "work_order_done"}', () => {
  it.each<StatusSpk>(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP'])('work_order_created dikirim ulang di status %s; baris otomatis dan kiriman ulang sama-sama tercatat', async (status) => {
    const { nomorHp, spk } = await spkDi(status);

    const detail = await kirimWa(b.pemilik.token, spk.number, 'work_order_created');

    const pesan = await harapan('work_order_created', detail);
    expect((await waPalsu.terakhir(nomorHp)).pesan).toBe(pesan);
    expect((await barisWaSpk(spk.number, 'work_order_created')).map((r) => [r.status, r.phone])).toEqual([
      ['sent', nomorHp],
      ['sent', nomorHp],
    ]);
    expect((await barisWaSpk(spk.number, 'work_order_created')).at(-1)?.body).toBe(pesan);
  });

  it('estimasi selesai tampil sebagai waktu WIB bila diisi, dan barisnya hilang bila null', async () => {
    const dengan = await spkPelangganBaru(b, { ubahSpk: { estimatedDoneAt: '2026-11-28T15:00:00+07:00' } });
    const tanpa = await spkPelangganBaru(b);

    const d1 = await kirimWa(b.kasir.token, dengan.spk.number, 'work_order_created');
    const d2 = await kirimWa(b.kasir.token, tanpa.spk.number, 'work_order_created');

    const p1 = (await waPalsu.terakhir(dengan.nomorHp)).pesan;
    const p2 = (await waPalsu.terakhir(tanpa.nomorHp)).pesan;
    expect(p1).toBe(await harapan('work_order_created', d1));
    expect(p1).toContain('\nEstimasi selesai: 28-11-2026 15:00 WIB\n');
    expect(p2).toBe(await harapan('work_order_created', d2));
    expect(p2).not.toContain('Estimasi selesai');
  });

  it('sesudah tautan lacak dibuat ulang, kiriman ulang memuat token baru', async () => {
    const { nomorHp, spk } = await spkDi();
    const baru = await buatUlangTautan(b.kasir.token, spk.number);
    expect(baru.trackingToken).not.toBe(spk.trackingToken);

    const detail = await kirimWa(b.kasir.token, spk.number, 'work_order_created');

    const pesan = (await waPalsu.terakhir(nomorHp)).pesan;
    expect(pesan).toBe(await harapan('work_order_created', detail));
    expect(pesan).toContain(tautanSpk(baru));
    expect(pesan).not.toContain(spk.trackingToken);
  });

  it.each<StatusSpk>(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS'])('work_order_done di status %s → 409 work_order_not_done, tanpa pesan dan tanpa baris', async (status) => {
    const { nomorHp, spk } = await spkDi(status);
    const sebelum = await jumlahPesan(nomorHp);

    harapGalat(await kirimWaSpk(b.kasir.token, spk.number, { type: 'work_order_done' }), 409, 'work_order_not_done');

    expect(await jumlahPesan(nomorHp)).toBe(sebelum);
    expect(await barisWaSpk(spk.number, 'work_order_done')).toEqual([]);
  });

  it.each<StatusSpk>(['DONE', 'PICKED_UP'])('work_order_done di status %s: dikirim ulang dengan total, dibayar, dan sisa saat ini', async (status) => {
    const { nomorHp, spk } = await spkDi(status);

    const detail = await kirimWa(b.kasir.token, spk.number, 'work_order_done');

    const pesan = (await waPalsu.terakhir(nomorHp)).pesan;
    expect(pesan).toBe(await harapan('work_order_done', detail));
    expect(pesan).toContain(status === 'PICKED_UP' ? 'Sisa: Rp0' : 'Sisa: Rp90.000');
    expect((await barisWaSpk(spk.number, 'work_order_done')).map((r) => r.status)).toEqual(['sent', 'sent']);
    expect(detail.wa.workOrderDone.status).toBe('sent');
  });

  it.each<JenisSpk>(['work_order_created', 'work_order_done', 'receipt'])('SPK CANCELLED → 409 work_order_cancelled untuk %s, tanpa pesan', async (type) => {
    const { nomorHp, spk } = await spkDi('CANCELLED');
    const sebelum = await jumlahPesan(nomorHp);
    const baris = (await barisWaSpk(spk.number)).length;

    harapGalat(await kirimWaSpk(b.kasir.token, spk.number, { type }), 409, 'work_order_cancelled');

    expect(await jumlahPesan(nomorHp)).toBe(sebelum);
    expect(await barisWaSpk(spk.number)).toHaveLength(baris);
  });
});

describe('POST /api/work-orders/{number}/wa: pesan disusun dengan data saat ini', () => {
  it('nama pelanggan, kendaraan, profil outlet, item, dan pembayaran yang berubah sesudah SPK dibuat ikut terbaca', async () => {
    const x = await spkPelangganBaru(b, { isi: true });
    wajib(await api.patch(`/api/customers/${x.pelanggan.customerId}`, { token: b.kasir.token, json: { name: 'Budi Hartono' } }), 200);
    wajib(await api.patch(`/api/vehicles/${x.kendaraan.vehicleId}`, { token: b.kasir.token, json: { brand: 'Yamaha', model: '' } }), 200);
    await bayar(b.kasir.token, x.spk.number, 25_000);
    const asal = await profilOutlet();
    await aturOutlet(b.pemilik.token, { name: 'Bengkel Jaya Abadi' });
    try {
      const detail = await kirimWa(b.kasir.token, x.spk.number, 'receipt');

      const pesan = (await waPalsu.terakhir(x.nomorHp)).pesan;
      expect(pesan).toBe(await harapan('receipt', detail));
      expect(pesan.startsWith('Bengkel Jaya Abadi\nNota SPK ')).toBe(true);
      expect(pesan).toContain('Halo Budi Hartono, terima kasih sudah servis di Bengkel Jaya Abadi.');
      expect(pesan).toContain(`Kendaraan: ${x.kendaraan.plate} (Yamaha)\n`);
      expect(pesan).toContain('Dibayar: Rp25.000\nSisa: Rp65.000');
    } finally {
      await aturOutlet(b.pemilik.token, asal);
    }
  });
});

describe('POST /api/work-orders/{number}/wa: nomor tujuan', () => {
  it('phone di badan hanya untuk pengiriman itu: nomor pelanggan tidak berubah, kiriman berikutnya kembali ke nomor pelanggan', async () => {
    const x = await spkPelangganBaru(b, { isi: true });
    const lain = nomorUnik();
    const sebelum = await jumlahPesan(x.nomorHp);

    const detail = await kirimWa(b.kasir.token, x.spk.number, 'receipt', nomorLokal(lain));

    expect((await waPalsu.untuk(lain)).map((m) => m.pesan)).toEqual([await harapan('receipt', detail)]);
    expect(await jumlahPesan(x.nomorHp)).toBe(sebelum);
    expect((await barisWaSpk(x.spk.number, 'receipt')).map((r) => r.phone)).toEqual([lain]);
    expect(detail.customer.phone).toBe(x.nomorHp);
    expect(wajib(await api.get(`/api/customers/${x.pelanggan.customerId}`, { token: b.kasir.token }), 200).body.data.phone).toBe(x.nomorHp);

    await kirimWa(b.kasir.token, x.spk.number, 'receipt');
    expect(await jumlahPesan(x.nomorHp)).toBe(sebelum + 1);
    expect(await waPalsu.untuk(lain)).toHaveLength(1);
  });

  it('phone dinormalisasi menjadi 628… (bentuk +62 dengan spasi dan tanda hubung, dan bentuk 08 yang perlu dipangkas)', async () => {
    const { spk } = await spkDi();
    const n1 = nomorUnik();
    const n2 = nomorUnik();

    await kirimWa(b.kasir.token, spk.number, 'receipt', `+62 ${n1.slice(2, 5)}-${n1.slice(5, 9)}-${n1.slice(9)}`);
    await kirimWa(b.kasir.token, spk.number, 'work_order_created', `\t ${nomorLokal(n2).slice(0, 4)} ${nomorLokal(n2).slice(4)}\n`);

    expect(await waPalsu.untuk(n1)).toHaveLength(1);
    expect(await waPalsu.untuk(n2)).toHaveLength(1);
    expect((await barisWaSpk(spk.number)).slice(-2).map((r) => r.phone)).toEqual([n1, n2]);
  });

  it('phone null sama dengan tidak dikirim; nomor pelanggan yang diubah sesudah SPK dibuat langsung dipakai', async () => {
    const x = await spkPelangganBaru(b);
    harapStatus(await kirimWaSpk(b.kasir.token, x.spk.number, { type: 'receipt', phone: null }), 200);
    expect(await jumlahPesan(x.nomorHp)).toBe(2);
    const baru = nomorUnik();
    wajib(await api.patch(`/api/customers/${x.pelanggan.customerId}`, { token: b.kasir.token, json: { phone: baru } }), 200);

    await kirimWa(b.kasir.token, x.spk.number, 'work_order_created');

    expect(await waPalsu.untuk(baru)).toHaveLength(1);
    expect(await jumlahPesan(x.nomorHp)).toBe(2);
  });

  it.each<[string, unknown, string]>([
    ['kosong', '', 'required'],
    ['hanya spasi', '   ', 'required'],
    ['angka', 6281234567890, 'invalid_type'],
    ['boolean', true, 'invalid_type'],
    ['huruf', 'abc', 'invalid_format'],
    ['+08… (awalan campur)', '+08123456789', 'invalid_format'],
    ['nomor luar negeri', '+6591234567', 'invalid_format'],
    ['9 digit sesudah diseragamkan', '08123456', 'too_short'],
    ['16 digit sesudah diseragamkan', `08${'1'.repeat(13)}`, 'too_long'],
  ])('phone %s → 422, tanpa pesan', async (_nama, phone, kode) => {
    const { nomorHp, spk } = await spkDi();
    const sebelum = await jumlahPesan(nomorHp);

    harapGalat(await kirimWaSpk(b.kasir.token, spk.number, { type: 'receipt', phone }), 422, 'validation_failed', { phone: kode });

    expect(await jumlahPesan(nomorHp)).toBe(sebelum);
    expect(await barisWaSpk(spk.number, 'receipt')).toEqual([]);
  });
});

describe('POST /api/work-orders/{number}/wa: type', () => {
  it.each<[string, Record<string, unknown>, string]>([
    ['tidak dikirim', {}, 'required'],
    ['null', { type: null }, 'required'],
    ['kosong', { type: '' }, 'required'],
    ['angka', { type: 1 }, 'invalid_type'],
    ['larik', { type: ['receipt'] }, 'invalid_type'],
    ['jenis pesan booking', { type: 'booking_confirmed' }, 'invalid_format'],
    ['huruf besar', { type: 'RECEIPT' }, 'invalid_format'],
    ['spasi di akhir (dibandingkan persis)', { type: 'receipt ' }, 'invalid_format'],
  ])('type %s → 422', async (_nama, json, kode) => {
    const { spk } = await spkDi();

    harapGalat(await kirimWaSpk(b.kasir.token, spk.number, json), 422, 'validation_failed', { type: kode });
  });

  it('type dan phone yang salah dilaporkan bersama', async () => {
    const { spk } = await spkDi();

    harapGalat(await kirimWaSpk(b.kasir.token, spk.number, { type: 'sms', phone: 'abc' }), 422, 'validation_failed', {
      type: 'invalid_format',
      phone: 'invalid_format',
    });
  });
});

describe('POST /api/work-orders/{number}/wa: urutan 413 → 400 → 401 → 403 → 404 → 422 → 409', () => {
  it('badan lebih dari 1 MiB → 413; badan bukan objek JSON → 400; sebelum 401, 403, dan 404', async () => {
    harapGalat(await api.post('/api/work-orders/S-9999/wa', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    for (const mentah of [JSON_RUSAK, '[]', 'null', '"receipt"', '']) {
      harapGalat(await api.post('/api/work-orders/S-9999/wa', { mentah }), 400, 'bad_request');
      harapGalat(await api.post('/api/work-orders/S-9999/wa', { mentah, token: b.mekanik.token }), 400, 'bad_request');
    }
  });

  it('tanpa token → 401; mekanik → 403 (juga untuk SPK miliknya dan nomor yang tidak ada), tanpa pesan', async () => {
    const x = await spkPelangganBaru(b, { ubahSpk: { mechanicId: b.mekanik.staff.staffId } });

    harapGalat(await kirimWaSpk(undefined, x.spk.number, { type: 'receipt' }), 401, 'unauthenticated');
    harapGalat(await kirimWaSpk(b.mekanik.token, x.spk.number, { type: 'receipt' }), 403, 'forbidden');
    harapGalat(await kirimWaSpk(b.mekanik.token, 'S-9999', { type: 'x' }), 403, 'forbidden');
    expect(await jumlahPesan(x.nomorHp)).toBe(1);
  });

  it('nomor tidak ada atau berbentuk lain → 404, sebelum 422', async () => {
    const { spk } = await spkDi();

    harapGalat(await kirimWaSpk(b.kasir.token, 'S-9999', { type: 'x' }), 404, 'not_found');
    harapGalat(await kirimWaSpk(b.kasir.token, spk.number.toLowerCase(), { type: 'receipt' }), 404, 'not_found');
  });

  it('422 (type, phone) mengalahkan 409', async () => {
    const batal = (await spkDi('CANCELLED')).spk;
    const antre = (await spkDi()).spk;

    harapGalat(await kirimWaSpk(b.kasir.token, batal.number, { type: 'x' }), 422, 'validation_failed', { type: 'invalid_format' });
    harapGalat(await kirimWaSpk(b.kasir.token, batal.number, { type: 'receipt', phone: 'abc' }), 422, 'validation_failed', { phone: 'invalid_format' });
    harapGalat(await kirimWaSpk(b.kasir.token, antre.number, { type: 'work_order_done', phone: '' }), 422, 'validation_failed', { phone: 'required' });
  });
});

// Alasan gagal: alasan dari penyedia bila badannya objek JSON dengan reason
// string, WA_TOKEN diganti ***, dipotong 255 code point; selalu terisi.
function alasanHarapan(mode: ModeGangguanWa): string | undefined {
  switch (mode) {
    case 'status-false':
      return 'device disconnected';
    case 'gema-token':
      return 'token tidak dikenali: ***';
    case 'alasan-panjang':
      return [...`gagal kirim: ${'é'.repeat(600)}`].slice(0, 255).join('');
    default:
      return undefined;
  }
}

function periksaAlasan(baris: BarisWa | undefined, mode: ModeGangguanWa): void {
  expect(baris?.status).toBe('failed');
  const alasan = baris?.failure_reason ?? '';
  expect([...alasan].length).toBeGreaterThan(0);
  expect([...alasan].length).toBeLessThanOrEqual(255);
  expect(alasan).not.toContain(bacaEnv().waToken);
  const pasti = alasanHarapan(mode);
  if (pasti !== undefined) {
    expect(alasan).toBe(pasti);
  }
}

describe('POST /api/work-orders/{number}/wa: gagal kirim → 503 wa_unavailable', () => {
  it.each<[string, ModeGangguanWa]>([
    ['status false (HTTP 200)', 'status-false'],
    ['HTTP 500 berbadan HTML', 'http-500'],
    ['koneksi putus', 'putus'],
    ['alasan 600 huruf non-ASCII, dipotong 255 code point', 'alasan-panjang'],
    ['alasan memuat ulang token, disamarkan', 'gema-token'],
  ])('nota gagal (%s): 503, baris failed tercatat dengan isi pesan, rincian menampilkan failed, token tidak bocor', async (_nama, mode) => {
    const { nomorHp, spk } = await spkDi();
    await waPalsu.gangguan({ gagal: true, nomor: nomorHp, mode });

    const res = await kirimWaSpk(b.kasir.token, spk.number, { type: 'receipt' });

    harapGalat(res, 503, 'wa_unavailable');
    expect(res.teks).not.toContain(bacaEnv().waToken);
    const baris = await barisWaSpk(spk.number, 'receipt');
    expect(baris).toHaveLength(1);
    const detail = await detailSpk(b.kasir.token, spk.number);
    expect(baris[0]).toMatchObject({ phone: nomorHp, body: await harapan('receipt', detail), work_order_id: await idSpk(spk.number), booking_id: null });
    periksaAlasan(baris[0], mode);
    expect(detail.wa).toMatchObject({ workOrderCreated: { status: 'sent' }, workOrderDone: null, receipt: { status: 'failed' } });
    expect(JSON.stringify(await barisWaSpk(spk.number))).not.toContain(bacaEnv().waToken);
  });

  it('pesan siap gagal: 503, wa.workOrderDone failed; baris otomatis sebelumnya tetap sent', async () => {
    const { nomorHp, spk } = await spkDi('DONE');
    await waPalsu.gangguan({ gagal: true, nomor: nomorHp, mode: 'putus' });

    harapGalat(await kirimWaSpk(b.kasir.token, spk.number, { type: 'work_order_done' }), 503, 'wa_unavailable');

    const baris = await barisWaSpk(spk.number, 'work_order_done');
    expect(baris.map((r) => r.status)).toEqual(['sent', 'failed']);
    periksaAlasan(baris[1], 'putus');
    expect((await detailSpk(b.kasir.token, spk.number)).wa.workOrderDone.status).toBe('failed');
  });

  it('gagal lalu berhasil: wa kembali sent, kedua percobaan tercatat berurutan', async () => {
    const { nomorHp, spk } = await spkDi();
    await waPalsu.gangguan({ gagal: true, nomor: nomorHp });
    harapGalat(await kirimWaSpk(b.kasir.token, spk.number, { type: 'work_order_created' }), 503, 'wa_unavailable');
    await waPalsu.gangguan({ gagal: false });

    const detail = await kirimWa(b.kasir.token, spk.number, 'work_order_created');

    expect(detail.wa.workOrderCreated.status).toBe('sent');
    expect((await barisWaSpk(spk.number, 'work_order_created')).map((r) => r.status)).toEqual(['sent', 'failed', 'sent']);
  });

  it('sukses lalu gagal: wa.receipt menunjuk percobaan terbaru; jenis lain tidak ikut berubah', async () => {
    const { nomorHp, spk } = await spkDi('DONE');
    await kirimWa(b.kasir.token, spk.number, 'receipt');
    await waPalsu.gangguan({ gagal: true, nomor: nomorHp });
    harapGalat(await kirimWaSpk(b.kasir.token, spk.number, { type: 'receipt' }), 503, 'wa_unavailable');

    const detail = await detailSpk(b.kasir.token, spk.number);

    expect(detail.wa).toMatchObject({ workOrderCreated: { status: 'sent' }, workOrderDone: { status: 'sent' }, receipt: { status: 'failed' } });
    const terbaru = (await barisWaSpk(spk.number, 'receipt')).at(-1)!;
    expect(Math.abs(Date.parse(detail.wa.receipt.createdAt) - terbaru.created_at.getTime())).toBeLessThanOrEqual(2);
  });

  it('wa memilih baris terbaru menurut created_at, lalu wa_message_id yang lebih besar bila waktunya sama', async () => {
    const sisipkan = async (nomor: string, id: string, jenis: JenisWa, status: 'sent' | 'failed', waktu: string): Promise<void> => {
      await jalankan(
        'INSERT INTO wa_messages (wa_message_id, type, phone, body, status, failure_reason, work_order_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, jenis, nomorUnik(), 'isi uji', status, status === 'failed' ? 'alasan uji' : null, await idSpk(nomor), waktu],
      );
    };
    const sama = '2099-10-31 07:00:00.000';
    const [a, c, d] = [(await spkDi()).spk, (await spkDi()).spk, (await spkDi()).spk];
    await sisipkan(a.number, 'ffffffff-0000-4000-8000-000000000001', 'receipt', 'sent', sama);
    await sisipkan(a.number, 'ffffffff-0000-4000-8000-000000000002', 'receipt', 'failed', sama);
    await sisipkan(c.number, 'ffffffff-0000-4000-8000-000000000011', 'work_order_created', 'failed', sama);
    await sisipkan(c.number, 'ffffffff-0000-4000-8000-000000000012', 'work_order_created', 'sent', sama);
    // ID lebih besar tetapi waktunya lebih lama: waktu yang menentukan.
    await sisipkan(d.number, 'ffffffff-0000-4000-8000-000000000022', 'receipt', 'sent', '2099-10-31 06:00:00.000');
    await sisipkan(d.number, 'ffffffff-0000-4000-8000-000000000021', 'receipt', 'failed', '2099-10-31 08:00:00.000');

    const [da, dc, dd] = await Promise.all([a, c, d].map((s) => detailSpk(b.kasir.token, s.number)));

    expect(da.wa.receipt.status).toBe('failed');
    expect(dc.wa.workOrderCreated.status).toBe('sent');
    expect(dd.wa.receipt.status).toBe('failed');
    expect(Date.parse(dd.wa.receipt.createdAt)).toBe(Date.parse('2099-10-31T08:00:00.000Z'));
  });
});

describe('POST /api/work-orders/{number}/wa: permintaan ke penyedia', () => {
  it('Authorization = WA_TOKEN tanpa Bearer, multipart, tepat satu field target dan satu field message; body tersimpan sama dengan yang dikirim', async () => {
    const { nomorHp, spk } = await spkDi();
    const sebelum = (await waPalsu.permintaan()).length;

    const detail = await kirimWa(b.kasir.token, spk.number, 'receipt');

    const permintaan = (await waPalsu.permintaan()).slice(sebelum).filter((p) => p.field?.target?.[0] === nomorHp);
    expect(permintaan).toHaveLength(1);
    const [p] = permintaan;
    expect(p).toMatchObject({ metode: 'POST', path: '/send', tokenSah: true, hasil: 'terkirim', fieldBerkas: [] });
    expect(p?.contentType).toMatch(/^multipart\/form-data;/i);
    expect(Object.keys(p?.field ?? {}).sort()).toEqual(['message', 'target']);
    expect(p?.field?.target).toEqual([nomorHp]);
    expect(p?.field?.message).toHaveLength(1);
    const dikirim = (p?.field?.message?.[0] ?? '').replace(/\r\n/g, '\n');
    expect(dikirim).toBe(await harapan('receipt', detail));
    expect((await barisWaSpk(spk.number, 'receipt'))[0]?.body).toBe(dikirim);
  });

  it('penyedia tidak dipanggil di dalam transaksi: pembayaran tidak menunggu kiriman WhatsApp yang sedang berjalan', async () => {
    const { nomorHp, spk } = await spkDi();
    await waPalsu.jeda(2500, nomorHp);
    let kirimSelesai = false;
    const kirim = kirimWaSpk(b.kasir.token, spk.number, { type: 'receipt' }).then((res) => {
      kirimSelesai = true;
      return res;
    });
    await waPalsu.tungguDikirim(nomorHp);

    const dibayar = await kirimBayar(b.pemilik.token, spk.number, { amount: 1000, method: 'cash' });
    const sudahSelesai = kirimSelesai;

    harapStatus(dibayar, 201);
    expect(sudahSelesai, 'pembayaran baru selesai sesudah WhatsApp terkirim: penyedia dipanggil di dalam transaksi?').toBe(false);
    harapStatus(await kirim, 200);
    expect((await barisSpk(spk.number)).paid_amount).toBe(1000);
  });
});
