// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Port dan database E2E (docs/eksekusi/aturan-bersama.md). Setiap backend punya baris sendiri,
// jadi E2E beberapa backend bisa berjalan bersamaan tanpa saling mengosongkan data. Baris Go dan
// NestJS sudah dicadangkan; cara membuild dan menyalakannya ditambahkan di bangunBackend()
// (src/bangun.ts) saat backend itu ada.
export type KodeBackend = 'go' | 'laravel' | 'nestjs';

export interface Backend {
  kode: KodeBackend;
  nama: string;
  folder: string;
  portBackend: number;
  portWa: number;
  portWeb: number;
  database: string;
}

export const BACKEND: Record<KodeBackend, Backend> = {
  go: { kode: 'go', nama: 'Go', folder: 'backend-go', portBackend: 8811, portWa: 8814, portWeb: 3811, database: 'bengkel_e2e_go' },
  laravel: {
    kode: 'laravel',
    nama: 'Laravel',
    folder: 'backend-laravel',
    portBackend: 8812,
    portWa: 8815,
    portWeb: 3812,
    database: 'bengkel_e2e_laravel',
  },
  nestjs: {
    kode: 'nestjs',
    nama: 'NestJS',
    folder: 'backend-nestjs',
    portBackend: 8813,
    portWa: 8816,
    portWeb: 3813,
    database: 'bengkel_e2e_nestjs',
  },
};

// Nilai uji yang sama dengan tes kontrak (tests/kontrak/src/env.ts). Semuanya palsu dan hanya
// dikenal WhatsApp palsu dan database lokal.
export const NILAI_UJI = {
  waToken: 'token-wa-uji-bengkel-bukan-kunci-asli',
  setupToken: 'token-setup-uji-bengkel-bukan-rahasia',
} as const;

export const FOLDER_E2E = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const AKAR_REPO = resolve(FOLDER_E2E, '..', '..');
// Semua yang dibuat harness (salinan sumber, build, log, sesi browser, laporan) ada di sini dan
// diabaikan git.
export const FOLDER_BANGUN = join(FOLDER_E2E, '.bangun');

export function bacaKodeBackend(teks: string | undefined): KodeBackend {
  if (teks === 'go' || teks === 'laravel' || teks === 'nestjs') return teks;
  throw new Error(`Backend "${teks ?? ''}" tidak dikenal; pilih laravel (go dan nestjs menyusul)`);
}

// Alamat yang dipakai harness dan browser. Backend dan WhatsApp palsu memakai 127.0.0.1
// (backend Laravel hanya mendengarkan IPv4), web memakai localhost supaya cookie sesi diterima
// browser walau tanpa HTTPS. PUBLIC_WEB_URL backend dan web sama dengan alamat web, jadi tautan di
// pesan WhatsApp bisa dibuka langsung oleh tes dan sama dengan tautan di nota. `webLain` adalah web
// yang sama lewat 127.0.0.1, untuk membuktikan tautan di panel memakai PUBLIC_WEB_URL, bukan
// alamat browser staf.
export const alamat = (b: Backend) => ({
  api: `http://127.0.0.1:${b.portBackend}`,
  wa: `http://127.0.0.1:${b.portWa}`,
  web: `http://localhost:${b.portWeb}`,
  webLain: `http://127.0.0.1:${b.portWeb}`,
  database: `mysql://bengkel:bengkel@127.0.0.1:3350/${b.database}`,
});
