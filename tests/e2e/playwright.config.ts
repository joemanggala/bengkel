// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { BACKEND, FOLDER_BANGUN, alamat, bacaKodeBackend } from './src/backend';

// Layanan dinyalakan src/jalankan.ts, yang juga mengisi E2E_BACKEND. Menjalankan
// "npx playwright test" langsung tidak menyalakan apa pun.
if (!process.env.E2E_BACKEND) {
  throw new Error('Jalankan lewat "npm run e2e -- --backend=laravel", bukan "npx playwright test" langsung');
}
const b = BACKEND[bacaKodeBackend(process.env.E2E_BACKEND)];

export default defineConfig({
  testDir: 'tes',
  // Satu database dan satu WhatsApp palsu per backend, dan skenario saling bergantung (pemilik
  // memasang aplikasi lebih dulu, baru kasir, mekanik, dan pelanggan memakainya), jadi semua
  // berjalan berurutan.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  // Server bawaan PHP (Laravel) melayani satu permintaan sekaligus, dan halaman Next.js memanggil
  // beberapa rute API berurutan; batasnya dibuat longgar untuk itu.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  outputDir: join(FOLDER_BANGUN, 'hasil', b.kode),
  reporter: [['list'], ['html', { outputFolder: join(FOLDER_BANGUN, 'laporan', b.kode), open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: alamat(b).web,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    viewport: { width: 1366, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'pemasangan', testMatch: '01-pemasangan.spec.ts' },
    { name: 'booking', testMatch: '02-booking-publik.spec.ts', dependencies: ['pemasangan'] },
    { name: 'spk', testMatch: '03-spk.spec.ts', dependencies: ['booking'] },
    { name: 'penolakan', testMatch: '04-penolakan-dan-batal.spec.ts', dependencies: ['spk'] },
    { name: 'batal-spk', testMatch: '05-batal-spk.spec.ts', dependencies: ['penolakan'] },
    { name: 'tautan-lacak', testMatch: '06-tautan-lacak.spec.ts', dependencies: ['batal-spk'] },
    { name: 'akses', testMatch: '07-akses.spec.ts', dependencies: ['tautan-lacak'] },
  ],
});
