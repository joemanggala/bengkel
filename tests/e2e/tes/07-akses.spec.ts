// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Kasir dan mekanik tidak bisa membuka halaman khusus pemilik (Rekap, Staf, Outlet, Jasa,
// Sparepart): menunya tidak tampil, alamatnya mengalihkan ke Papan servis dengan penjelasan, dan
// API-nya menolak 403 walau dipanggil langsung. Mekanik juga tidak bisa membuka halaman kasir.

import { type Page, expect, test } from '@playwright/test';
import { SESI_KASIR, SESI_MEKANIK, SESI_PEMILIK, panggilBff, tanggalWib } from './pembantu';

const HALAMAN_PEMILIK = [
  { menu: 'Rekap', alamat: '/admin/rekap' },
  { menu: 'Staf', alamat: '/admin/staf' },
  { menu: 'Outlet', alamat: '/admin/outlet' },
  { menu: 'Jasa', alamat: '/admin/jasa' },
  { menu: 'Sparepart', alamat: '/admin/sparepart' },
];
const HALAMAN_KASIR = [
  { menu: 'SPK baru', alamat: '/admin/spk/baru' },
  { menu: 'Booking', alamat: '/admin/booking' },
  { menu: 'Pelanggan', alamat: '/admin/pelanggan' },
];

// API khusus pemilik, dipanggil lewat BFF dengan sesi peran lain. Badan sengaja JSON sah: peran
// dinilai sebelum isi badan, jadi yang diharapkan 403, bukan 422.
const API_PEMILIK: [string, string, unknown?][] = [
  ['GET', `/staf/reports/daily?date=${tanggalWib()}`],
  ['GET', '/staf/staff'],
  ['POST', '/staf/staff', { name: 'Penyusup', email: 'penyusup@e2e.contoh.id', password: 'SandiPenyusup1', role: 'owner' }],
  ['PUT', '/staf/outlet', { name: 'Bengkel Diambil Alih' }],
  ['POST', '/staf/services', { name: 'Jasa Liar', price: 1000 }],
  ['POST', '/staf/parts', { sku: 'LIAR-1', name: 'Part Liar', unit: 'pcs', price: 1000, costPrice: 0, minStock: 0, initialStock: 0 }],
];

async function cekDitolak(page: Page, halaman: { menu: string; alamat: string }[]) {
  await page.goto('/admin/papan');
  const menu = page.getByRole('navigation', { name: 'Menu utama' });
  await expect(menu.getByRole('link', { name: 'Papan servis' })).toBeVisible();
  for (const h of halaman) {
    await expect(menu.getByRole('link', { name: h.menu, exact: true })).toHaveCount(0);
    await page.goto(h.alamat);
    await expect(page, `${h.alamat} harus dialihkan`).toHaveURL(/\/admin\/papan\?akses=ditolak$/);
    await expect(page.getByText('Halaman tadi tidak tersedia untuk peranmu')).toBeVisible();
  }
}

async function cekApiDitolak(page: Page) {
  for (const [metode, jalur, badan] of API_PEMILIK) {
    expect(await panggilBff(page, metode, jalur, badan), `${metode} ${jalur}`).toEqual({ status: 403, kode: 'forbidden' });
  }
}

test('kasir tidak bisa membuka Rekap, Staf, Outlet, Jasa, atau Sparepart', async ({ browser }) => {
  const kasir = await (await browser.newContext({ storageState: SESI_KASIR })).newPage();
  await cekDitolak(kasir, HALAMAN_PEMILIK);
  await cekApiDitolak(kasir);
  // Halaman kasir tetap terbuka untuknya.
  await kasir.goto('/admin/booking');
  await expect(kasir.getByRole('heading', { name: 'Booking', level: 1 })).toBeVisible();
  await kasir.context().close();
});

test('mekanik tidak bisa membuka halaman pemilik maupun halaman kasir', async ({ browser }) => {
  const mekanik = await (await browser.newContext({ storageState: SESI_MEKANIK })).newPage();
  await cekDitolak(mekanik, [...HALAMAN_PEMILIK, ...HALAMAN_KASIR]);
  await cekApiDitolak(mekanik);
  expect(await panggilBff(mekanik, 'GET', '/staf/bookings')).toEqual({ status: 403, kode: 'forbidden' });
  await mekanik.context().close();
});

test('pemilik tetap bisa membuka semua halaman, dan tidak ada akun atau data liar yang tercipta', async ({ browser }) => {
  const pemilik = await (await browser.newContext({ storageState: SESI_PEMILIK })).newPage();
  for (const h of [...HALAMAN_PEMILIK, ...HALAMAN_KASIR]) {
    await pemilik.goto(h.alamat);
    await expect(pemilik).toHaveURL(new RegExp(`${h.alamat}$`));
  }
  await pemilik.goto('/admin/staf');
  await expect(pemilik.getByRole('row')).toHaveCount(5); // judul + pemilik, kasir, dua mekanik
  await expect(pemilik.getByText('Penyusup')).toHaveCount(0);
  await pemilik.goto('/admin/outlet');
  await expect(pemilik.getByLabel('Nama bengkel')).not.toHaveValue('Bengkel Diambil Alih');
  await pemilik.context().close();
});
