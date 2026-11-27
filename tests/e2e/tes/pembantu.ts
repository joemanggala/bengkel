// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Data skenario dan pembantu yang dipakai bersama berkas tes: membaca WhatsApp palsu, masuk
// sebagai staf, memanggil BFF dari halaman, lokasi sesi browser, dan hitungan uang yang ditulis
// ulang di sini (bukan diimpor dari kode produk) supaya tes tetap bisa menangkap salah hitung di
// sisi produk.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Locator, type Page, expect } from '@playwright/test';
import { BACKEND, FOLDER_BANGUN, NILAI_UJI, alamat, bacaKodeBackend } from '../src/backend';

export const backend = BACKEND[bacaKodeBackend(process.env.E2E_BACKEND)];
export const ALAMAT = alamat(backend);
export const SETUP_TOKEN = NILAI_UJI.setupToken;

const sesi = (nama: string) => join(FOLDER_BANGUN, 'sesi', `${backend.kode}-${nama}.json`);
export const SESI_PEMILIK = sesi('pemilik');
export const SESI_KASIR = sesi('kasir');
export const SESI_MEKANIK = sesi('mekanik');
export const SESI_MEKANIK_LAIN = sesi('mekanik-lain');

export interface Akun {
  nama: string;
  email: string;
  sandi: string;
}

export const PEMILIK: Akun = { nama: 'Sari Pemilik', email: 'pemilik@e2e.contoh.id', sandi: 'SandiPemilik123' };
export const KASIR: Akun = { nama: 'Rina Kasir', email: 'kasir@e2e.contoh.id', sandi: 'SandiKasir123' };
export const MEKANIK: Akun = { nama: 'Andi Mekanik', email: 'andi@e2e.contoh.id', sandi: 'SandiMekanik123' };
// Mekanik kedua: SPK miliknya tidak boleh terlihat oleh MEKANIK, dan sebaliknya.
export const MEKANIK_LAIN: Akun = { nama: 'Bayu Mekanik', email: 'bayu@e2e.contoh.id', sandi: 'SandiMekanik456' };

export const OUTLET = {
  nama: 'Bengkel Sinar E2E',
  tagline: 'Servis motor dan mobil, cepat dan jujur.',
  hp: '0812-1111-2222',
  alamat: 'Jl. Kenanga No. 7, Bandung',
  jamBuka: 'Senin-Sabtu 08.00-17.00',
  kakiNota: 'Garansi servis 7 hari.',
};

// Tiga jasa: satu tampil di website, satu disembunyikan dari website, satu nonaktif (juga
// dicentang tampil, untuk membuktikan jasa nonaktif tidak muncul di website walau ditandai tampil).
export const JASA = {
  publik: { nama: 'Ganti Oli Mesin', harga: 35000, durasi: '30', deskripsi: 'Termasuk cek rem dan rantai.' },
  tersembunyi: { nama: 'Bongkar Mesin', harga: 450000, durasi: '480', deskripsi: 'Hanya lewat konsultasi.' },
  nonaktif: { nama: 'Cuci Motor', harga: 15000, durasi: '20', deskripsi: 'Sedang tidak tersedia.' },
};

// Sparepart dengan stok awal dan harga beli (modal) khusus pemilik.
export const PART = {
  oli: { sku: 'OLI-10W40', nama: 'Oli Mesin 10W-40 1L', satuan: 'botol', harga: 55000, beli: 40000, stok: 10 },
  kampas: { sku: 'KMP-DEPAN', nama: 'Kampas Rem Depan', satuan: 'set', harga: 80000, beli: 52000, stok: 3 },
};

// Nomor HP ditulis seperti diketik orang; WhatsApp palsu menerimanya dalam bentuk 628….
export const PELANGGAN = {
  booking: { nama: 'Budi Santoso', hp: '0812-3456-7890', wa: '6281234567890', plat: 'B 1234 XYZ', merek: 'Honda', tipe: 'Vario 125' },
  ditolak: { nama: 'Citra Lestari', hp: '0813-5555-0001', wa: '6281355550001', plat: 'D 4321 AB', merek: 'Yamaha', tipe: 'NMAX' },
  batal: { nama: 'Dewi Anggraini', hp: '0815-7777-0002', wa: '6281577770002', plat: 'F 77 CD', merek: 'Suzuki', tipe: '' },
  datang: { nama: 'Eko Prasetyo', hp: '0856-1212-3434', wa: '6285612123434', plat: 'B 9 EKO', merek: 'Toyota', tipe: 'Avanza' },
};

// ---- Data yang dibuat satu skenario dan dipakai skenario sesudahnya ----

export interface DataSkenario {
  spkBooking?: string;
  spkDatang?: string;
  tautanLacak?: string;
  bookingToken?: string;
}

const BERKAS_DATA = join(FOLDER_BANGUN, 'sesi', `${backend.kode}-data.json`);

// Dibaca saat skenario berjalan (dari dalam tes), bukan saat berkas dimuat: Playwright memuat semua
// berkas tes lebih dulu untuk mendaftar tes, sedangkan berkas ini baru dibuat skenario sebelumnya.
export function bacaData(): DataSkenario {
  try {
    return JSON.parse(readFileSync(BERKAS_DATA, 'utf8')) as DataSkenario;
  } catch {
    return {};
  }
}

export function simpanData(tambahan: DataSkenario): void {
  mkdirSync(dirname(BERKAS_DATA), { recursive: true });
  writeFileSync(BERKAS_DATA, JSON.stringify({ ...bacaData(), ...tambahan }, null, 2));
}

export function kosongkanData(): void {
  mkdirSync(dirname(BERKAS_DATA), { recursive: true });
  writeFileSync(BERKAS_DATA, '{}');
}

// ---- Uang dan tanggal, ditulis ulang dari aturan di docs/rancangan.md ----

// Seperti tampil di layar: Rp35.000 (tanpa spasi, titik pemisah ribuan).
export const rupiah = (n: number): string => `${n < 0 ? '-' : ''}Rp${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

// Tanggal WIB (YYYY-MM-DD) dengan geser hari, sama dengan tanggal bawaan halaman rekap.
export const tanggalWib = (geserHari = 0): string => new Date(Date.now() + 7 * 3600_000 + geserHari * 86_400_000).toISOString().slice(0, 10);

// "2026-11-28" -> "28-11-2026", seperti tanggal di pesan WhatsApp dan halaman booking.
export const tanggalTampil = (iso: string): string => iso.split('-').reverse().join('-');

// ---- WhatsApp palsu ----

export interface PesanWa {
  nomor: number;
  waktu: string;
  target: string;
  pesan: string;
}

export async function pesanWa(nomor: string): Promise<PesanWa[]> {
  const r = await fetch(`${ALAMAT.wa}/__kendali/pesan?to=${nomor}`);
  return ((await r.json()) as { data: PesanWa[] }).data;
}

// Pesan WhatsApp dikirim sesudah transaksi tersimpan dan sebelum backend membalas, tetapi tetap
// ditunggu sebentar supaya tes tidak bergantung pada urutan render halaman.
export async function tungguPesanWa(nomor: string, jumlah: number): Promise<PesanWa[]> {
  await expect.poll(async () => (await pesanWa(nomor)).length, { message: `pesan WhatsApp untuk ${nomor}` }).toBe(jumlah);
  return pesanWa(nomor);
}

// Tautan lacak (/servis/<token>) dari teks pesan WhatsApp.
export function tautanDariPesan(pesan: string): string {
  const cocok = new RegExp(`${ALAMAT.web}/servis/[A-Za-z0-9_-]{43}`).exec(pesan);
  expect(cocok, `tautan lacak di pesan:\n${pesan}`).not.toBeNull();
  return cocok![0];
}

// ---- Halaman ----

export const toast = (page: Page): Locator => page.locator('[data-toast]');

// Masuk lewat halaman masuk seperti staf, lalu menunggu Papan servis terbuka.
export async function masuk(page: Page, akun: Akun): Promise<void> {
  await page.goto('/admin/masuk');
  await page.getByLabel('Email').fill(akun.email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(akun.sandi);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/papan$/);
  await expect(page.getByRole('heading', { name: 'Papan servis', level: 1 })).toBeVisible();
}

// Satu baris tabel yang memuat teks tertentu.
export const baris = (wadah: Page | Locator, teks: string | RegExp): Locator => wadah.getByRole('row').filter({ hasText: teks });

// Isi <dd> dari pasangan <dt>label</dt><dd>isi</dd> di dalam wadah.
export const nilaiDl = (wadah: Page | Locator, label: string): Locator =>
  wadah.locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]');

// Kartu panel (<section> dengan judul <h2>) berdasarkan judulnya.
export const kartu = (page: Page, judul: string): Locator =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: judul, exact: true, level: 2 }) });

// Memanggil BFF dari dalam halaman (asal sama, cookie sesi ikut), seperti komponen klien.
export async function panggilBff(page: Page, metode: string, jalur: string, badan?: unknown): Promise<{ status: number; kode?: string }> {
  return page.evaluate(
    async ({ metode, jalur, badan }) => {
      const r = await fetch(`/bff${jalur}`, {
        method: metode,
        headers: badan === undefined ? {} : { 'Content-Type': 'application/json' },
        body: badan === undefined ? undefined : JSON.stringify(badan),
      });
      const isi = (await r.json().catch(() => null)) as { error?: { code?: string } } | null;
      return { status: r.status, kode: isi?.error?.code };
    },
    { metode, jalur, badan },
  );
}

// GET ke BFF dari dalam halaman dan mengembalikan badan JSON-nya (cookie sesi halaman ikut).
export async function bffJson<T = unknown>(page: Page, jalur: string): Promise<{ status: number; badan: T }> {
  return page.evaluate(async (jalur) => {
    const r = await fetch(`/bff${jalur}`);
    return { status: r.status, badan: (await r.json().catch(() => null)) as never };
  }, jalur);
}

export interface PartApi {
  partId: string;
  sku: string;
  name: string;
  stock: number;
  costPrice?: number;
}

// Sparepart menurut SKU, dibaca lewat BFF dengan sesi halaman (pemilik melihat costPrice).
export async function partDariSku(page: Page, sku: string): Promise<PartApi> {
  const { status, badan } = await bffJson<{ data: PartApi[] }>(page, `/staf/parts?search=${encodeURIComponent(sku)}`);
  expect(status).toBe(200);
  const part = badan.data.find((p) => p.sku === sku);
  expect(part, `sparepart ${sku}`).toBeDefined();
  return part!;
}
