// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { nyalakanWaPalsu } from './server';

// Port dev 8890; tes kontrak memakai 8891 (Go), 8892 (Laravel), dan 8893
// (NestJS), E2E 8814-8816. Semuanya dipilih lewat WA_PALSU_PORT.
const port = Number(process.env.WA_PALSU_PORT ?? 8890);
if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  console.error('WA_PALSU_PORT harus nomor port 1..65535');
  process.exit(1);
}

const hidup = await nyalakanWaPalsu({
  port,
  host: process.env.WA_PALSU_HOST || undefined,
  // Token bawaan sengaja palsu dan sama dengan yang dipakai tes kontrak.
  token: process.env.WA_TOKEN || undefined,
});

console.log(`WhatsApp palsu siap: kirim ke ${hidup.alamat}/send, lihat pesan di ${hidup.alamat}`);

for (const sinyal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinyal, () => {
    void hidup.tutup().then(() => process.exit(0));
  });
}
