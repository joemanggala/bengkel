// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { afterAll, beforeAll } from 'vitest';
import { kosongkanDatabase, tutupDatabase } from './db';
import { waPalsu } from './wa';

// Dijalankan sebelum setiap berkas tes: database uji dan WhatsApp palsu
// dimulai dari keadaan kosong, sehingga urutan berkas tidak memengaruhi hasil.
beforeAll(async () => {
  await kosongkanDatabase();
  await waPalsu.reset();
});

afterAll(async () => {
  await tutupDatabase();
});
