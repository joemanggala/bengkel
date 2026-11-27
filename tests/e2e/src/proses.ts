// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Menyalakan, menunggu, dan mematikan proses layanan (backend, WhatsApp palsu, web). Semua
// keluaran layanan ditulis ke berkas log, supaya terminal hanya berisi hasil tes, dan log bisa
// dibaca bila ada yang gagal.

import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname } from 'node:path';

const WINDOWS = process.platform === 'win32';

export interface Layanan {
  nama: string;
  anak: ChildProcess;
  berkasLog: string;
  selesai: boolean;
  kodeKeluar: number | null;
}

export interface OpsiNyala {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  berkasLog: string;
  // .bat/.cmd (mis. npm.cmd) hanya bisa dijalankan lewat shell di Windows.
  shell?: boolean;
}

export function nyalakan(nama: string, perintah: string, args: string[], opsi: OpsiNyala): Layanan {
  mkdirSync(dirname(opsi.berkasLog), { recursive: true });
  const fd = openSync(opsi.berkasLog, 'w');
  const anak = spawn(perintah, args, {
    cwd: opsi.cwd,
    env: { ...process.env, ...opsi.env },
    stdio: ['ignore', fd, fd],
    windowsHide: true,
    shell: opsi.shell ?? false,
    // Di Linux/macOS proses menjadi ketua grup sendiri, supaya anak-anaknya (mis. php -S yang
    // dijalankan artisan) ikut mati saat grupnya dimatikan.
    detached: !WINDOWS,
  });
  closeSync(fd);
  const layanan: Layanan = { nama, anak, berkasLog: opsi.berkasLog, selesai: false, kodeKeluar: null };
  anak.on('exit', (kode) => {
    layanan.selesai = true;
    layanan.kodeKeluar = kode;
  });
  anak.on('error', () => {
    layanan.selesai = true;
  });
  return layanan;
}

export function ekorLog(berkas: string, baris = 30): string {
  try {
    return readFileSync(berkas, 'utf8').split(/\r?\n/).slice(-baris).join('\n');
  } catch {
    return '(log belum ada)';
  }
}

// Mematikan proses beserta seluruh anaknya. Di Windows taskkill /T diperlukan: membunuh
// artisan saja meninggalkan php -S tetap mendengarkan port.
export function matikan(layanan: Layanan): void {
  const pid = layanan.anak.pid;
  if (pid === undefined || layanan.selesai) return;
  try {
    if (WINDOWS) {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // Sudah mati lebih dulu.
  }
}

const jeda = (ms: number) => new Promise((r) => setTimeout(r, ms));

// true bila ada yang mendengarkan di port itu (IPv4 atau IPv6).
export async function portDipakai(port: number): Promise<boolean> {
  const coba = (host: string) =>
    new Promise<boolean>((selesai) => {
      const soket = createConnection({ host, port });
      soket.setTimeout(1000);
      soket.once('connect', () => {
        soket.destroy();
        selesai(true);
      });
      soket.once('timeout', () => {
        soket.destroy();
        selesai(false);
      });
      soket.once('error', () => selesai(false));
    });
  return (await coba('127.0.0.1')) || (await coba('::1'));
}

// Menunggu sampai cek() benar. Proses yang keburu mati langsung dilaporkan beserta ekor lognya,
// tanpa menunggu batas waktu habis.
export async function tungguSiap(layanan: Layanan, cek: () => Promise<boolean>, batasMs: number): Promise<void> {
  const akhir = Date.now() + batasMs;
  while (Date.now() < akhir) {
    if (layanan.selesai) {
      throw new Error(`${layanan.nama} berhenti (kode ${layanan.kodeKeluar}). Ekor log ${layanan.berkasLog}:\n${ekorLog(layanan.berkasLog)}`);
    }
    try {
      if (await cek()) return;
    } catch {
      // Belum mendengarkan.
    }
    await jeda(300);
  }
  throw new Error(`${layanan.nama} belum siap dalam ${batasMs / 1000} detik. Ekor log ${layanan.berkasLog}:\n${ekorLog(layanan.berkasLog)}`);
}

export const balasanOk = async (url: string): Promise<boolean> =>
  (await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'manual' })).status < 500;

// Menjalankan perintah sampai selesai (build). Keluaran ditulis ke log; galat menyertakan
// ekornya.
export async function jalankanSampaiSelesai(nama: string, perintah: string, args: string[], opsi: OpsiNyala): Promise<void> {
  const layanan = nyalakan(nama, perintah, args, opsi);
  await new Promise<void>((selesai, gagal) => {
    layanan.anak.once('error', (e) => gagal(new Error(`${nama} tidak bisa dijalankan: ${e.message}`)));
    layanan.anak.once('exit', (kode) => {
      if (kode === 0) selesai();
      else gagal(new Error(`${nama} gagal (kode ${kode}). Ekor log ${opsi.berkasLog}:\n${ekorLog(opsi.berkasLog, 40)}`));
    });
  });
}
