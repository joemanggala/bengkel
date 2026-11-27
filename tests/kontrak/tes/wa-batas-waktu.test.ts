// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Batas waktu 10 detik permintaan ke penyedia WhatsApp (whatsapp.md bagian 2):
// balasan yang tiba sebelum 10 detik wajib ditunggu, penyedia yang belum
// membalas sesudah 10 detik dianggap gagal dan backend tidak menunggu lebih
// lama. WhatsApp palsu menahan balasan dengan `jeda` (sampai 15 detik) untuk
// satu nomor saja; permintaan yang ditinggal backend tercatat "ditinggal" dan
// pesannya tidak disimpan. Berkas ini lambat (sekitar 35 detik) karena memang
// menunggu batas waktunya.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buatPelangganDenganKendaraan, detailSpk, siapkanBengkel, type Bengkel } from '../src/data';
import { barisSpk, barisWaSpk } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { waPalsu } from '../src/wa';
import { kirimWaSpk, spkPelangganBaru } from './pembantu-uang';

const BATAS_MS = 10_000;
// Kelonggaran di bawah batas (cara pustaka HTTP menghitung waktu) dan di atasnya
// (kerja backend sesudah waktu habis: mencatat baris failed dan menyusun balasan).
const MIN_HABIS_MS = BATAS_MS - 500;
const MAKS_HABIS_MS = BATAS_MS + 4_000;
const LAMA_TES_MS = 40_000;

let b: Bengkel;

beforeAll(async () => {
  b = await siapkanBengkel();
});

afterEach(async () => {
  await waPalsu.jeda(0);
  await waPalsu.gangguan({ gagal: false });
});

async function berwaktu<T>(kerja: () => Promise<T>): Promise<{ hasil: T; ms: number }> {
  const mulai = Date.now();
  const hasil = await kerja();
  return { hasil, ms: Date.now() - mulai };
}

// Menunggu WhatsApp palsu selesai menahan permintaan ke `nomor`, lalu
// membalas hasil permintaan terakhir untuk nomor itu.
async function hasilTerakhir(nomor: string, batasMs = 8_000): Promise<string | undefined> {
  const batas = Date.now() + batasMs;
  let hasil: string | undefined;
  while (Date.now() < batas) {
    hasil = (await waPalsu.permintaan()).filter((p) => p.field?.target?.[0] === nomor).at(-1)?.hasil;
    if (hasil !== 'diproses') {
      return hasil;
    }
    await new Promise((selesai) => setTimeout(selesai, 100));
  }
  return hasil;
}

describe('kirim ulang: batas waktu 10 detik', () => {
  it(
    'penyedia tidak membalas 12 detik → 503 wa_unavailable sesudah sekitar 10 detik, baris failed tercatat, pesan tidak terkirim',
    async () => {
      const { nomorHp, spk } = await spkPelangganBaru(b, { isi: true });
      await waPalsu.jeda(12_000, nomorHp);

      const { hasil: res, ms } = await berwaktu(() => kirimWaSpk(b.kasir.token, spk.number, { type: 'receipt' }));

      harapGalat(res, 503, 'wa_unavailable');
      expect(ms, 'backend menyerah sebelum 10 detik?').toBeGreaterThanOrEqual(MIN_HABIS_MS);
      expect(ms, 'backend menunggu lebih dari 10 detik?').toBeLessThanOrEqual(MAKS_HABIS_MS);
      const baris = await barisWaSpk(spk.number, 'receipt');
      expect(baris).toHaveLength(1);
      expect(baris[0]?.status).toBe('failed');
      expect((baris[0]?.failure_reason ?? '').length).toBeGreaterThan(0);
      expect((await detailSpk(b.kasir.token, spk.number)).wa.receipt.status).toBe('failed');
      // Backend menutup koneksinya saat waktu habis, jadi WhatsApp palsu tidak menyimpan pesannya.
      expect(await hasilTerakhir(nomorHp)).toBe('ditinggal');
      expect((await waPalsu.untuk(nomorHp)).map((p) => p.pesan)).not.toContainEqual(baris[0]?.body);
    },
    LAMA_TES_MS,
  );

  it(
    'penyedia membalas sesudah 8 detik (masih di bawah batas) → ditunggu: 200 dan wa.receipt sent',
    async () => {
      const { nomorHp, spk } = await spkPelangganBaru(b, { isi: true });
      await waPalsu.jeda(8_000, nomorHp);

      const { hasil: res, ms } = await berwaktu(() => kirimWaSpk(b.kasir.token, spk.number, { type: 'receipt' }));

      harapStatus(res, 200);
      expect(ms).toBeGreaterThanOrEqual(7_900);
      expect(res.body.data.wa.receipt.status).toBe('sent');
      expect((await barisWaSpk(spk.number, 'receipt')).map((r) => r.status)).toEqual(['sent']);
      expect(await hasilTerakhir(nomorHp)).toBe('terkirim');
    },
    LAMA_TES_MS,
  );
});

describe('pengiriman otomatis: batas waktu 10 detik', () => {
  it(
    'membuat SPK saat penyedia tidak membalas 12 detik → 201 sesudah sekitar 10 detik, SPK tersimpan, wa.workOrderCreated failed',
    async () => {
      const { pelanggan, kendaraan } = await buatPelangganDenganKendaraan(b.kasir.token);
      await waPalsu.jeda(12_000, pelanggan.phone);

      const { hasil: res, ms } = await berwaktu(() =>
        api.post('/api/work-orders', { token: b.kasir.token, json: { vehicleId: kendaraan.vehicleId, complaint: 'Servis rutin.' } }),
      );

      harapStatus(res, 201);
      expect(ms).toBeGreaterThanOrEqual(MIN_HABIS_MS);
      expect(ms).toBeLessThanOrEqual(MAKS_HABIS_MS);
      expect(res.body.data.wa.workOrderCreated.status).toBe('failed');
      expect((await barisSpk(res.body.data.number)).status).toBe('QUEUED');
      expect((await barisWaSpk(res.body.data.number, 'work_order_created')).map((r) => r.status)).toEqual(['failed']);
      expect(await hasilTerakhir(pelanggan.phone)).toBe('ditinggal');
    },
    LAMA_TES_MS,
  );
});
