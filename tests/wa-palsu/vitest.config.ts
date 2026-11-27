// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tes/**/*.test.ts'],
    testTimeout: 15_000,
  },
});
