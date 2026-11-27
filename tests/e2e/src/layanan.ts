// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Menyalakan layanan satu backend di port E2E-nya: WhatsApp palsu, backend, dan (bila diminta)
// web. Dipakai E2E web (jalankan.ts).

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { type Backend, NILAI_UJI, alamat } from './backend';
import { FOLDER_LOG, bangunBackend, bangunWeb, siapkanWaPalsu } from './bangun';
import { kosongkanDatabase } from './db';
import { type Layanan, balasanOk, matikan, nyalakan, portDipakai, tungguSiap } from './proses';

export class Tumpukan {
  private readonly hidup: Layanan[] = [];

  constructor(private readonly b: Backend) {}

  // Port yang sudah dipakai berarti sisa jalan sebelumnya atau proses orang lain. Keduanya tidak
  // dimatikan otomatis: lebih aman berhenti dan memberi tahu.
  async pastikanPortBebas(denganWeb: boolean): Promise<void> {
    const port = [this.b.portBackend, this.b.portWa, ...(denganWeb ? [this.b.portWeb] : [])];
    const dipakai: number[] = [];
    for (const p of port) if (await portDipakai(p)) dipakai.push(p);
    if (dipakai.length > 0) {
      throw new Error(`Port ${dipakai.join(', ')} sudah dipakai proses lain. Matikan dulu proses itu (mis. sisa E2E yang terhenti).`);
    }
  }

  async siapkan(denganWeb: boolean): Promise<void> {
    const a = alamat(this.b);
    await this.pastikanPortBebas(denganWeb);
    console.log(`- mengosongkan database ${this.b.database}`);
    await kosongkanDatabase(a.database);

    console.log('- build');
    const backend = await bangunBackend(this.b);
    const web = denganWeb ? await bangunWeb(this.b) : null;

    const folderWa = await siapkanWaPalsu();
    console.log(`- WhatsApp palsu di ${a.wa}`);
    const wa = this.catat(
      nyalakan('WhatsApp palsu', process.execPath, [join('node_modules', 'tsx', 'dist', 'cli.mjs'), join('src', 'main.ts')], {
        cwd: folderWa,
        env: { WA_PALSU_PORT: String(this.b.portWa), WA_PALSU_HOST: '127.0.0.1', WA_TOKEN: NILAI_UJI.waToken },
        berkasLog: join(FOLDER_LOG, `${this.b.kode}-wa-palsu.log`),
      }),
    );
    const sidik = createHash('sha256').update(NILAI_UJI.waToken).digest('hex');
    await tungguSiap(
      wa,
      async () => {
        const r = await fetch(`${a.wa}/__kendali/ping`, { signal: AbortSignal.timeout(3000) });
        return r.ok && ((await r.json()) as { sidikToken?: string }).sidikToken === sidik;
      },
      30_000,
    );

    console.log(`- backend ${this.b.nama} di ${a.api}`);
    const api = this.catat(
      nyalakan(`backend ${this.b.nama}`, backend.perintah, backend.args, {
        cwd: backend.cwd,
        env: {
          PORT: String(this.b.portBackend),
          DATABASE_URL: a.database,
          WA_API_URL: `${a.wa}/send`,
          WA_TOKEN: NILAI_UJI.waToken,
          SETUP_TOKEN: NILAI_UJI.setupToken,
          // Tautan /servis/<token> dan /booking di pesan WhatsApp menunjuk ke web E2E ini.
          PUBLIC_WEB_URL: a.web,
        },
        berkasLog: join(FOLDER_LOG, `${this.b.kode}-backend.log`),
      }),
    );
    await tungguSiap(
      api,
      async () => {
        const r = await fetch(`${a.api}/api/health`, { signal: AbortSignal.timeout(3000) });
        return r.ok && ((await r.json()) as { status?: string }).status === 'ok';
      },
      120_000,
    );

    if (web) {
      console.log(`- web di ${a.web}`);
      const next = this.catat(
        nyalakan('web', process.execPath, [join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(this.b.portWeb)], {
          cwd: web,
          env: { API_URL: a.api, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
          berkasLog: join(FOLDER_LOG, `${this.b.kode}-web.log`),
        }),
      );
      await tungguSiap(next, () => balasanOk(`${a.web}/admin/masuk`), 120_000);
    }
  }

  private catat(layanan: Layanan): Layanan {
    this.hidup.push(layanan);
    return layanan;
  }

  // Dimatikan dari yang terakhir dinyalakan. Setelahnya port dicek lagi, supaya proses anak
  // yang lolos (mis. php -S) langsung ketahuan.
  async matikanSemua(): Promise<void> {
    for (const l of [...this.hidup].reverse()) matikan(l);
    this.hidup.length = 0;
    await new Promise((r) => setTimeout(r, 500));
    const port = [this.b.portBackend, this.b.portWa, this.b.portWeb];
    const sisa: number[] = [];
    for (const p of port) if (await portDipakai(p)) sisa.push(p);
    if (sisa.length > 0) console.error(`PERHATIAN: port ${sisa.join(', ')} masih dipakai setelah layanan dimatikan`);
  }
}

// Ctrl+C dan galat tak tertangkap tetap mematikan semua layanan.
export function pasangPenutup(tumpukan: Tumpukan): void {
  let sedangMenutup = false;
  const tutup = (kode: number) => {
    if (sedangMenutup) return;
    sedangMenutup = true;
    void tumpukan.matikanSemua().finally(() => process.exit(kode));
  };
  process.on('SIGINT', () => tutup(130));
  process.on('SIGTERM', () => tutup(143));
}
