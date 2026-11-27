// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Build untuk E2E dibuat dari salinan sumber di .bangun/sumber/, bukan di folder aslinya:
// .next milik `npm run dev` di web/ tidak pernah tersentuh (tanpa mengubah distDir di
// next.config), dan folder milik pelaksana lain tetap persis seperti yang mereka tulis.
// node_modules salinan adalah junction ke node_modules asli, jadi tidak perlu npm ci ulang.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { AKAR_REPO, type Backend, FOLDER_BANGUN } from './backend';
import { jalankanSampaiSelesai } from './proses';

export const FOLDER_SUMBER = join(FOLDER_BANGUN, 'sumber');
export const FOLDER_LOG = join(FOLDER_BANGUN, 'log');
const BERKAS_SIDIK = '.sidik-sumber';

// Berkas sumber satu folder repo menurut git: yang dilacak ditambah yang belum dilacak tetapi
// tidak diabaikan. node_modules, .next, dist, dan .env tidak ikut.
export function berkasSumber(folder: string): string[] {
  const isi = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', `${folder}/`], {
    cwd: AKAR_REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return [...new Set(isi.split('\0').filter(Boolean))].filter((p) => existsSync(join(AKAR_REPO, p))).sort();
}

// Sidik isi berkas sumber. Dengan `salinan`, isi dibaca dari salinan (path tanpa awalan folder),
// supaya salinan yang terlanjur diubah tangan tidak ikut dipakai ulang.
export function sidikSumber(daftar: string[], salinan?: { folder: string; tujuan: string }): string {
  const hash = createHash('sha256');
  for (const path of daftar) {
    const asal = salinan ? join(salinan.tujuan, path.slice(salinan.folder.length + 1)) : join(AKAR_REPO, path);
    let isi: Buffer;
    try {
      isi = readFileSync(asal);
    } catch {
      return '';
    }
    hash.update(path).update('\0').update(isi).update('\0');
  }
  return hash.digest('hex');
}

// Junction dilepas lebih dulu, baru foldernya dihapus. Menghapus rekursif lewat junction bisa
// ikut menghapus isi node_modules asli milik folder lain.
function hapusSalinan(tujuan: string): void {
  const tautan = join(tujuan, 'node_modules');
  try {
    if (lstatSync(tautan).isSymbolicLink()) unlinkSync(tautan);
  } catch {
    // Belum ada junction.
  }
  if (existsSync(tautan)) throw new Error(`${tautan} bukan junction; hapus manual sebelum membangun ulang`);
  rmSync(tujuan, { recursive: true, force: true });
}

// Junction node_modules salinan selalu diarahkan ke lokasi dependensi saat ini, karena lokasinya
// bisa berpindah (node_modules asli dihapus, lalu dipakai pasangan milik harness).
function pasangJunction(tujuan: string, target: string): void {
  const tautan = join(tujuan, 'node_modules');
  try {
    if (lstatSync(tautan).isSymbolicLink()) {
      if (resolve(readlinkSync(tautan)) === resolve(target)) return;
      unlinkSync(tautan);
    }
  } catch {
    // Belum ada junction.
  }
  if (existsSync(tautan)) throw new Error(`${tautan} bukan junction; hapus manual sebelum membangun ulang`);
  symlinkSync(target, tautan, 'junction');
}

// Menyalin sumber folder repo ke .bangun/sumber/<nama>. Mengembalikan false bila salinan dan
// build sebelumnya masih sesuai sumber (sidik sama dan penanda build ada), sehingga build bisa
// dilewati. nodeModules: folder dependensi yang dipasang sebagai junction (lihat siapkanNodeModules).
export function siapkanSalinan(folder: string, nama: string, penandaBuild: string, nodeModules: string | null): {
  tujuan: string;
  perluBuild: boolean;
} {
  const tujuan = join(FOLDER_SUMBER, nama);
  const daftar = berkasSumber(folder);
  if (daftar.length === 0) throw new Error(`Folder ${folder}/ kosong atau tidak ada di repo`);
  const sidik = sidikSumber(daftar);
  const berkasSidik = join(tujuan, BERKAS_SIDIK);
  if (
    existsSync(berkasSidik) &&
    readFileSync(berkasSidik, 'utf8') === sidik &&
    existsSync(join(tujuan, penandaBuild)) &&
    sidikSumber(daftar, { folder, tujuan }) === sidik
  ) {
    if (nodeModules) pasangJunction(tujuan, nodeModules);
    return { tujuan, perluBuild: false };
  }
  hapusSalinan(tujuan);
  for (const path of daftar) {
    const ke = join(tujuan, path.slice(folder.length + 1));
    mkdirSync(dirname(ke), { recursive: true });
    copyFileSync(join(AKAR_REPO, path), ke);
  }
  if (nodeModules) pasangJunction(tujuan, nodeModules);
  return { tujuan, perluBuild: true };
}

const NPM_CLI = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

// Dependensi untuk salinan: node_modules milik folder aslinya bila ada (tanpa mengubahnya), atau
// bila tidak ada, dipasang sendiri dengan `npm ci` dari package.json dan package-lock.json folder
// itu ke .bangun/deps/<folder>. Folder milik pelaksana lain tidak pernah ditulisi.
export async function siapkanNodeModules(folder: string): Promise<string> {
  const asli = join(AKAR_REPO, folder, 'node_modules');
  if (existsSync(join(asli, '.package-lock.json'))) return asli;
  const tujuan = join(FOLDER_BANGUN, 'deps', folder.replaceAll('/', '-'));
  const berkas = ['package.json', 'package-lock.json', '.npmrc'].filter((b) => existsSync(join(AKAR_REPO, folder, b)));
  const hash = createHash('sha256');
  for (const b of berkas) hash.update(b).update('\0').update(readFileSync(join(AKAR_REPO, folder, b))).update('\0');
  const sidik = hash.digest('hex');
  const berkasSidik = join(tujuan, BERKAS_SIDIK);
  if (existsSync(berkasSidik) && readFileSync(berkasSidik, 'utf8') === sidik && existsSync(join(tujuan, 'node_modules'))) {
    return join(tujuan, 'node_modules');
  }
  console.log(`  ${folder}/node_modules tidak ada; npm ci ke ${tujuan} …`);
  rmSync(tujuan, { recursive: true, force: true });
  mkdirSync(tujuan, { recursive: true });
  for (const b of berkas) copyFileSync(join(AKAR_REPO, folder, b), join(tujuan, b));
  await jalankanSampaiSelesai(`npm ci ${folder}`, process.execPath, [NPM_CLI, 'ci', '--prefer-offline', '--no-audit', '--no-fund'], {
    cwd: tujuan,
    berkasLog: join(FOLDER_LOG, `deps-${folder.replaceAll('/', '-')}.log`),
  });
  writeFileSync(berkasSidik, sidik);
  return join(tujuan, 'node_modules');
}

export const tandaiTerbangun = (tujuan: string, folder: string) =>
  writeFileSync(join(tujuan, BERKAS_SIDIK), sidikSumber(berkasSumber(folder)));

const env = { NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' };

// Web dibuild sekali per backend (salinan sendiri), lalu dipakai ulang selama sumbernya tidak
// berubah. API_URL dibaca saat berjalan, bukan saat build.
export async function bangunWeb(b: Backend): Promise<string> {
  const { tujuan, perluBuild } = siapkanSalinan('web', `web-${b.kode}`, join('.next', 'BUILD_ID'), await siapkanNodeModules('web'));
  if (perluBuild) {
    console.log(`  build web (${tujuan}) …`);
    await jalankanSampaiSelesai('build web', process.execPath, [join('node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
      cwd: tujuan,
      env,
      berkasLog: join(FOLDER_LOG, `${b.kode}-build-web.log`),
    });
    tandaiTerbangun(tujuan, 'web');
  } else {
    console.log('  build web masih sesuai sumber, dipakai ulang');
  }
  return tujuan;
}

// WhatsApp palsu dijalankan dari salinannya sendiri, dengan dependensi dari siapkanNodeModules.
export async function siapkanWaPalsu(): Promise<string> {
  const { tujuan, perluBuild } = siapkanSalinan('tests/wa-palsu', 'wa-palsu', join('src', 'main.ts'), await siapkanNodeModules('tests/wa-palsu'));
  if (perluBuild) tandaiTerbangun(tujuan, 'tests/wa-palsu');
  return tujuan;
}

// Backend dibuat menjadi perintah yang siap dijalankan: [perintah, argumen, cwd]. Backend Go dan
// NestJS (menyusul) ditambahkan di sini dengan pola yang sama: build dari salinan di
// .bangun/sumber/ (siapkanSalinan), lalu kembalikan perintah untuk menyalakannya.
export async function bangunBackend(b: Backend): Promise<{ perintah: string; args: string[]; cwd: string }> {
  if (b.kode !== 'laravel') {
    throw new Error(`Backend ${b.nama} belum ada di harness E2E; tambahkan cara build-nya di bangunBackend (src/bangun.ts)`);
  }
  // Laravel tidak perlu build. Ia dijalankan dari foldernya sendiri dengan env dari baris
  // perintah (yang selalu menang atas .env), memakai vendor/ hasil composer install pemiliknya.
  // bengkel:serve memeriksa env dan database lebih dulu, lalu menyalakan server bawaan PHP.
  const folder = join(AKAR_REPO, 'backend-laravel');
  if (!existsSync(join(folder, 'vendor', 'autoload.php'))) {
    throw new Error('backend-laravel/vendor belum ada; jalankan composer install di backend-laravel');
  }
  return { perintah: 'php', args: ['artisan', 'bengkel:serve'], cwd: folder };
}
