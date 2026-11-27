// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import fixtur from '../fixtur/bcrypt.json';
import { nyalakanWaPalsu } from '../../wa-palsu/src/server';
import { buatPool, pastikanDatabaseUji, SQL_BARIS_AWAL, TABEL } from './db';
import { samarkanUrl, type EnvUji } from './env';

function tidur(ms: number): Promise<void> {
  return new Promise((selesai) => setTimeout(selesai, ms));
}

// Database uji wajib sudah dimigrasi sampai versi terbaru (sekarang 1,
// 000001_awal) dengan ke-16 tabelnya. Database yang setengah jadi gagal di
// sini dengan pesan yang jelas, bukan dengan galat SQL di tengah tes.
export const VERSI_MIGRATION = 1;

export async function cekDatabase(env: EnvUji): Promise<void> {
  pastikanDatabaseUji(env.databaseUrl);
  const pool = buatPool(env.databaseUrl);
  try {
    let ada: number;
    try {
      const [baris] = await pool.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?)',
        [TABEL],
      );
      ada = Number((baris as Array<{ n: number }>)[0]?.n ?? 0);
    } catch (galat) {
      throw new Error(
        `Database uji tidak bisa dihubungi di ${samarkanUrl(env.databaseUrl)}: ${(galat as Error).message}. ` +
          'Nyalakan dengan "docker compose up -d mysql".',
      );
    }
    if (ada !== TABEL.length) {
      throw new Error(
        `Database uji baru punya ${ada} dari ${TABEL.length} tabel. Jalankan migration "up" untuk database ini (mis. "docker compose run --rm migrate-uji-laravel up").`,
      );
    }
    const [versi] = await pool.query('SELECT version, dirty FROM schema_migrations LIMIT 1');
    const catatan = (versi as Array<{ version: number | string; dirty: number }>)[0];
    if (!catatan || Number(catatan.version) < VERSI_MIGRATION || Number(catatan.dirty) !== 0) {
      throw new Error(
        `Database uji belum dimigrasi sampai versi ${VERSI_MIGRATION}; versi sekarang ${catatan?.version ?? 'tidak diketahui'}${catatan?.dirty ? ' dan statusnya dirty' : ''}. ` +
          'Jalankan migration "up" untuk database ini.',
      );
    }
  } finally {
    await pool.end();
  }
}

export interface LayananHidup {
  tutup(): Promise<void>;
}

const HOST_LOKAL = ['localhost', '127.0.0.1', '::1', '[::1]'];

async function ping(url: string): Promise<Record<string, unknown> | undefined> {
  try {
    const res = await fetch(`${url}/__kendali/ping`, { signal: AbortSignal.timeout(1_500) });
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

// Memakai WhatsApp palsu yang sudah menyala (mis. dari "npm start" di
// tests/wa-palsu) bila ada; bila belum, menyalakannya di proses harness.
export async function pastikanWaPalsu(env: EnvUji): Promise<LayananHidup | undefined> {
  const jawab = await ping(env.waPalsuUrl);
  if (jawab) {
    if (jawab.layanan !== 'wa-palsu') {
      throw new Error(`${env.waPalsuUrl} menjawab, tetapi bukan WhatsApp palsu`);
    }
    if (jawab.sidikToken !== createHash('sha256').update(env.waToken).digest('hex')) {
      throw new Error(`WhatsApp palsu di ${env.waPalsuUrl} memakai WA_TOKEN lain dari harness; matikan atau samakan env-nya`);
    }
    return undefined;
  }
  const alamat = new URL(env.waPalsuUrl);
  if (!HOST_LOKAL.includes(alamat.hostname)) {
    throw new Error(`WhatsApp palsu tidak menjawab di ${env.waPalsuUrl}, dan harness hanya bisa menyalakannya di localhost`);
  }
  return nyalakanWaPalsu({ port: Number(alamat.port || 80), token: env.waToken });
}

export async function tungguBackend(env: EnvUji): Promise<void> {
  const batas = Date.now() + env.tungguBackendDetik * 1000;
  let terakhir = 'belum ada jawaban';
  while (Date.now() < batas) {
    try {
      const res = await fetch(`${env.baseUrl}/api/health`, { signal: AbortSignal.timeout(2_000) });
      const isi = (await res.json().catch(() => undefined)) as { status?: string } | undefined;
      if (res.status === 200 && isi?.status === 'ok') {
        return;
      }
      terakhir = `HTTP ${res.status}`;
    } catch (galat) {
      // fetch hanya menulis "fetch failed"; penyebab yang berguna (mis.
      // ECONNREFUSED) ada di galat.cause.
      const sebab = (galat as { cause?: { code?: string; message?: string } }).cause;
      terakhir = sebab?.code ?? sebab?.message ?? (galat as Error).message;
    }
    await tidur(500);
  }
  throw new Error(
    `Backend tidak bisa dihubungi di ${env.baseUrl} (GET /api/health selama ${env.tungguBackendDetik} detik, terakhir: ${terakhir}). ` +
      'Nyalakan backend uji dengan env di docs/menjalankan.md bagian "Tes kontrak".',
  );
}

export async function kosongkanDenganPool(pool: Pool): Promise<void> {
  const koneksi = await pool.getConnection();
  try {
    await koneksi.query('SET SESSION lock_wait_timeout = 10');
    await koneksi.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tabel of TABEL) {
      await koneksi.query(`TRUNCATE TABLE \`${tabel}\``);
    }
    for (const sql of SQL_BARIS_AWAL) {
      await koneksi.query(sql);
    }
  } finally {
    await koneksi.query('SET FOREIGN_KEY_CHECKS = 1');
    koneksi.release();
  }
}

async function butuhSetup(env: EnvUji): Promise<unknown> {
  const res = await fetch(`${env.baseUrl}/api/setup`, { signal: AbortSignal.timeout(10_000) });
  const isi = (await res.json().catch(() => undefined)) as { data?: { needsSetup?: unknown } } | undefined;
  return res.status === 200 ? isi?.data?.needsSetup : `HTTP ${res.status}`;
}

async function postJson(env: EnvUji, path: string, badan: unknown, token?: string): Promise<{ status: number; isi: any }> {
  const res = await fetch(`${env.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(badan),
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, isi: await res.json().catch(() => undefined) };
}

// Membuktikan dua hal sebelum tes dimulai:
// 1. Backend membaca database uji yang sama dengan harness. Tanpa ini,
//    backend yang tersambung ke database dev tetap terlihat "jalan", tetapi
//    setiap pemeriksaan database di tes gagal dengan cara yang membingungkan.
// 2. Bila backend sudah bisa membuat SPK, pesan work_order_created wajib tiba
//    di WhatsApp palsu. Bila tidak, WA_API_URL backend menunjuk ke penyedia
//    lain, dan tes akan mengirim ratusan pesan WhatsApp sungguhan. Berhenti.
export async function buktikanDatabaseBackend(env: EnvUji): Promise<void> {
  const pool = buatPool(env.databaseUrl);
  try {
    await kosongkanDenganPool(pool);
    const kosong = await butuhSetup(env);
    const email = `probe-${randomUUID()}@contoh.id`;
    await pool.query(
      "INSERT INTO staff (staff_id, name, email, password_hash, role, is_active) VALUES (?, 'Probe Harness', ?, ?, 'owner', TRUE)",
      [randomUUID(), email, fixtur.hash.node],
    );
    const berisi = await butuhSetup(env);
    if (kosong !== true || berisi !== false) {
      throw new Error(
        `Backend di ${env.baseUrl} tidak membaca database ${samarkanUrl(env.databaseUrl)}: GET /api/setup membalas needsSetup ` +
          `${String(kosong)} saat tabel staff kosong dan ${String(berisi)} saat berisi. Periksa DATABASE_URL backend.`,
      );
    }

    // Bagian berikut hanya bisa berjalan setelah backend mendukung pelanggan,
    // kendaraan, dan SPK; sebelum itu cukup peringatan, supaya tes yang sudah
    // bisa dijalankan tidak terhalang.
    const lewati = (sebab: string): void => console.warn(`Peringatan: ${sebab}; pemeriksaan WhatsApp backend dilewati.`);
    const masuk = await postJson(env, '/api/staff/login', { email, password: fixtur.sandi });
    const token = masuk.isi?.data?.token as string | undefined;
    if (masuk.status !== 200 || !token) {
      return lewati(`masuk staf percobaan membalas ${masuk.status}`);
    }
    const phone = '6281999000111';
    const pelanggan = await postJson(env, '/api/customers', { name: 'Probe Harness', phone }, token);
    if (pelanggan.status !== 201) {
      return lewati(`membuat pelanggan percobaan membalas ${pelanggan.status}`);
    }
    const kendaraan = await postJson(
      env,
      `/api/customers/${pelanggan.isi.data.customerId}/vehicles`,
      { type: 'MOTOR', plate: 'Z 9999 ZZ', brand: 'Probe' },
      token,
    );
    if (kendaraan.status !== 201) {
      return lewati(`membuat kendaraan percobaan membalas ${kendaraan.status}`);
    }
    // SPK baru langsung mengirim work_order_created ke nomor pelanggan.
    const spk = await postJson(env, '/api/work-orders', { vehicleId: kendaraan.isi.data.vehicleId, complaint: 'Probe harness' }, token);
    if (spk.status !== 201) {
      return lewati(`membuat SPK percobaan membalas ${spk.status}`);
    }
    if (spk.isi?.data?.wa?.workOrderCreated?.status === 'failed') {
      throw new Error(
        `Backend di ${env.baseUrl} gagal mengirim WhatsApp. Arahkan WA_API_URL backend ke ${env.waPalsuUrl}/send ` +
          'dan samakan WA_TOKEN-nya dengan harness.',
      );
    }
    const res = await fetch(`${env.waPalsuUrl}/__kendali/pesan?to=${phone}`);
    const pesan = ((await res.json()) as { data?: unknown[] }).data ?? [];
    if (pesan.length === 0) {
      throw new Error(
        `Backend di ${env.baseUrl} membuat SPK dan membalas 201, tetapi pesannya tidak tiba di WhatsApp palsu ${env.waPalsuUrl}. ` +
          `Periksa WA_API_URL backend (harus ${env.waPalsuUrl}/send) sebelum menjalankan tes.`,
      );
    }
  } finally {
    await kosongkanDenganPool(pool).catch(() => undefined);
    await fetch(`${env.waPalsuUrl}/__kendali/reset`, { method: 'POST' }).catch(() => undefined);
    await pool.end();
  }
}
