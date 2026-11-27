// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export interface EnvUji {
  baseUrl: string;
  databaseUrl: string;
  waPalsuUrl: string;
  // Tiga nilai berikut wajib sama dengan env backend yang diuji.
  waToken: string;
  // String kosong = backend diuji dengan SETUP_TOKEN kosong (setup mati).
  setupToken: string;
  // Tanpa garis miring di akhir, sama seperti backend membuangnya
  // (spec/openapi.yaml, "Env bersama backend"). Dipakai untuk merangkai
  // tautan lacak di pesan WhatsApp yang diharapkan.
  publicWebUrl: string;
  tungguBackendDetik: number;
}

export const NILAI_UJI = {
  waToken: 'token-wa-uji-bengkel-bukan-kunci-asli',
  setupToken: 'token-setup-uji-bengkel-bukan-rahasia',
  publicWebUrl: 'http://localhost:3880',
} as const;

const DATABASE_URL_AWAL = 'mysql://bengkel:bengkel@127.0.0.1:3350/';

// Port uji tiap backend (docs/eksekusi/aturan-bersama.md). Bila BASE_URL
// memakai salah satu port ini dan DATABASE_URL/WA_PALSU_URL tidak diisi,
// harness memakai database uji dan WhatsApp palsu milik backend itu, supaya
// "BASE_URL=http://localhost:8882 npm test" langsung benar untuk Laravel dan
// suite tiga backend tidak saling mengosongkan tabel.
const PASANGAN_PORT: Record<string, { database: string; waPort: number }> = {
  '8881': { database: 'bengkel_uji', waPort: 8891 },
  '8882': { database: 'bengkel_uji_laravel', waPort: 8892 },
  '8883': { database: 'bengkel_uji_nestjs', waPort: 8893 },
};
const PASANGAN_BAWAAN = { database: 'bengkel_uji', waPort: 8891 };

const BERKAS_ENV = fileURLToPath(new URL('../.env', import.meta.url));

function isiBerkasEnv(): Record<string, string | undefined> {
  return existsSync(BERKAS_ENV) ? parseEnv(readFileSync(BERKAS_ENV, 'utf8')) : {};
}

// .env bersifat opsional dan hanya mengisi nama yang belum ada di shell,
// supaya "BASE_URL=... npm test" selalu menang.
export function muatEnvLokal(): void {
  for (const [nama, nilai] of Object.entries(isiBerkasEnv())) {
    if (process.env[nama] === undefined && nilai !== undefined) {
      process.env[nama] = nilai;
    }
  }
}

const POLA_ALAMAT = /^https?:\/\/[^/]+/;

// Vitest mengisi process.env.BASE_URL dengan base URL Vite ("/") di worker,
// dan juga di proses utama bila BASE_URL tidak diisi. Karena itu alamat backend
// diambil dari kandidat pertama yang benar-benar berbentuk http(s)://, dengan
// urutan: salinan dari vitest.config.ts, env shell, lalu berkas .env.
export function alamatBackend(): string | undefined {
  for (const kandidat of [process.env.BENGKEL_BASE_URL, process.env.BASE_URL, isiBerkasEnv().BASE_URL]) {
    const alamat = kandidat?.trim();
    if (alamat && POLA_ALAMAT.test(alamat)) {
      return alamat;
    }
  }
  return undefined;
}

function tanpaGarisMiring(url: string): string {
  return url.replace(/\/+$/, '');
}

function pasanganUntuk(baseUrl: string): { database: string; waPort: number } {
  try {
    return PASANGAN_PORT[new URL(baseUrl).port] ?? PASANGAN_BAWAAN;
  } catch {
    return PASANGAN_BAWAAN;
  }
}

export function bacaEnv(): EnvUji {
  muatEnvLokal();
  const baseUrl = alamatBackend();
  if (!baseUrl) {
    throw new Error('BASE_URL wajib berisi alamat backend, contoh: BASE_URL=http://localhost:8882 npm test');
  }
  const tunggu = Number(process.env.TUNGGU_BACKEND_DETIK || 30);
  const pasangan = pasanganUntuk(baseUrl);
  return {
    baseUrl: tanpaGarisMiring(baseUrl),
    databaseUrl: process.env.DATABASE_URL || `${DATABASE_URL_AWAL}${pasangan.database}`,
    waPalsuUrl: tanpaGarisMiring(process.env.WA_PALSU_URL || `http://localhost:${pasangan.waPort}`),
    waToken: process.env.WA_TOKEN || NILAI_UJI.waToken,
    // "??", bukan "||": SETUP_TOKEN= (kosong) sengaja dipakai untuk menguji
    // backend yang setup-nya mati.
    setupToken: process.env.SETUP_TOKEN ?? NILAI_UJI.setupToken,
    publicWebUrl: tanpaGarisMiring((process.env.PUBLIC_WEB_URL || NILAI_UJI.publicWebUrl).trim()),
    tungguBackendDetik: Number.isFinite(tunggu) && tunggu > 0 ? tunggu : 30,
  };
}

// Dipakai di pesan galat: alamat database tanpa sandi, supaya log tes tidak
// pernah memuat kredensial.
export function samarkanUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) {
      u.password = '***';
    }
    return u.toString();
  } catch {
    return '(DATABASE_URL tidak terbaca)';
  }
}
