// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { defineConfig } from 'vitest/config';
import { alamatBackend, muatEnvLokal } from './src/env';

// Vitest mengisi process.env.BASE_URL di setiap worker dengan base URL milik
// Vite ("/"), padahal harness memakai nama itu untuk alamat backend. Nilai
// dari shell (atau .env) disalin ke nama lain sebelum worker dibuat.
muatEnvLokal();

export default defineConfig({
  test: {
    include: ['tes/**/*.test.ts'],
    globalSetup: ['src/global-setup.ts'],
    setupFiles: ['src/siapkan-berkas.ts'],
    env: {
      BENGKEL_BASE_URL: alamatBackend() ?? '',
    },
    // Semua berkas memakai satu database uji dan satu WhatsApp palsu yang
    // dikosongkan di awal tiap berkas, jadi berkas tidak boleh berjalan
    // bersamaan.
    fileParallelism: false,
    testTimeout: 30_000,
    // Pengosongan 16 tabel di awal tiap berkas bisa lambat saat mesin sibuk (mis. beberapa suite
    // backend berjalan bersamaan); 60 detik pernah terlampaui tanpa ada yang salah di kode.
    hookTimeout: 120_000,
  },
});
