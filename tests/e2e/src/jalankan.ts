// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Satu perintah E2E web per backend:
//
//   npm run e2e -- --backend=laravel [argumen Playwright lain, mis. --headed]
//
// (go dan nestjs menyusul; port dan databasenya sudah dicadangkan di src/backend.ts.)
//
// Database E2E backend itu dikosongkan, backend + WhatsApp palsu + web dibuild dan dinyalakan
// di port E2E-nya, Playwright dijalankan, lalu semua layanan dimatikan apa pun hasilnya.

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { BACKEND, FOLDER_E2E, alamat, bacaKodeBackend } from './backend';
import { Tumpukan, pasangPenutup } from './layanan';

function bacaArgumen(argv: string[]): { kode: string | undefined; sisa: string[] } {
  let kode: string | undefined;
  const sisa: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--backend=')) kode = a.slice('--backend='.length);
    else if (a === '--backend') kode = argv[++i];
    else sisa.push(a);
  }
  return { kode, sisa };
}

async function utama(): Promise<number> {
  const { kode, sisa } = bacaArgumen(process.argv.slice(2));
  const b = BACKEND[bacaKodeBackend(kode)];
  const a = alamat(b);
  console.log(`E2E web melawan backend ${b.nama}: web ${a.web}, backend ${a.api}, WhatsApp palsu ${a.wa}, database ${b.database}`);

  const tumpukan = new Tumpukan(b);
  pasangPenutup(tumpukan);
  try {
    await tumpukan.siapkan(true);
    console.log('- Playwright');
    const cli = join(FOLDER_E2E, 'node_modules', '@playwright', 'test', 'cli.js');
    return await new Promise<number>((selesai) => {
      const anak = spawn(process.execPath, [cli, 'test', ...sisa], {
        cwd: FOLDER_E2E,
        env: { ...process.env, E2E_BACKEND: b.kode },
        stdio: 'inherit',
      });
      anak.on('exit', (k) => selesai(k ?? 1));
    });
  } catch (e) {
    console.error(`\nE2E ${b.nama} berhenti: ${(e as Error).message}`);
    return 1;
  } finally {
    console.log('- mematikan layanan');
    await tumpukan.matikanSemua();
  }
}

process.exitCode = await utama();
