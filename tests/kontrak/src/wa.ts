// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { bacaEnv } from './env';

export interface PesanWa {
  nomor: number;
  waktu: string;
  target: string;
  // Isi pesan sesudah CRLF diganti LF.
  pesan: string;
}

export interface CatatanPermintaanWa {
  nomor: number;
  metode: string;
  path: string;
  tokenSah: boolean;
  contentType: string | null;
  field: Record<string, string[]> | null;
  fieldBerkas: string[];
  hasil: 'diproses' | 'terkirim' | 'ditolak' | 'gangguan' | 'ditinggal';
  alasan: string | null;
  statusHttp: number | null;
}

export type ModeGangguanWa = 'status-false' | 'http-500' | 'putus' | 'alasan-panjang' | 'gema-token' | 'status-besar';

async function kendali(path: string, badan?: unknown): Promise<any> {
  const { waPalsuUrl } = bacaEnv();
  const res = await fetch(`${waPalsuUrl}/__kendali/${path}`, {
    method: badan === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: badan === undefined ? undefined : JSON.stringify(badan),
    signal: AbortSignal.timeout(10_000),
  });
  const isi = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(`Kendali WhatsApp palsu ${path} gagal (${res.status}): ${isi?.error ?? JSON.stringify(isi)}`);
  }
  return isi;
}

export const waPalsu = {
  ping: async (): Promise<{ ok: boolean; layanan: string; jalur: string; sidikToken: string }> => kendali('ping'),
  reset: async (): Promise<void> => {
    await kendali('reset', {});
  },
  // Tanpa nomor = semua nomor. Mode bawaan "status-false": HTTP 200 dengan
  // {"status": false}, seperti Fonnte.
  gangguan: async (opsi: { gagal: boolean; nomor?: string; mode?: ModeGangguanWa }): Promise<void> => {
    await kendali('gangguan', opsi);
  },
  semua: async (): Promise<PesanWa[]> => (await kendali('pesan')).data,
  untuk: async (nomor: string): Promise<PesanWa[]> => (await kendali(`pesan?to=${encodeURIComponent(nomor)}`)).data,
  terakhir: async (nomor: string): Promise<PesanWa> => {
    const pesan = (await waPalsu.untuk(nomor)).at(-1);
    if (!pesan) {
      throw new Error(`Tidak ada pesan WhatsApp untuk ${nomor} di WhatsApp palsu; apakah WA_API_URL backend menunjuk ke ${bacaEnv().waPalsuUrl}/send?`);
    }
    return pesan;
  },
  permintaan: async (): Promise<CatatanPermintaanWa[]> => (await kendali('permintaan')).data,
  // Menahan balasan /send selama ms (0..15000) untuk satu nomor atau semua.
  // Lebih dari 10000 = melewati batas waktu backend (permintaan yang ditinggal
  // backend tercatat "ditinggal" dan pesannya tidak disimpan).
  // Dipakai tes serentak supaya backend pasti sedang menunggu penyedia
  // WhatsApp saat permintaan lain datang.
  jeda: async (ms: number, nomor?: string): Promise<void> => {
    await kendali('jeda', nomor === undefined ? { ms } : { ms, nomor });
  },
  // Menunggu sampai backend sedang mengirim pesan ke nomor itu (permintaan
  // sudah tiba di WhatsApp palsu dan sedang ditahan jeda).
  tungguDikirim: async (nomor: string, batasMs = 10_000): Promise<void> => {
    const batas = Date.now() + batasMs;
    while (Date.now() < batas) {
      const ada = (await waPalsu.permintaan()).some((p) => p.hasil === 'diproses' && p.field?.target?.[0] === nomor);
      if (ada) {
        return;
      }
      await new Promise((selesai) => setTimeout(selesai, 20));
    }
    throw new Error(`Backend tidak mengirim pesan WhatsApp ke ${nomor} dalam ${batasMs} ms`);
  },
};
