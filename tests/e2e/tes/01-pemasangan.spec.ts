// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pemasangan awal seperti pemilik bengkel yang baru membeli aplikasi: server kosong → akun pemilik
// → profil outlet → tiga jasa (tampil, disembunyikan, nonaktif) → dua sparepart dengan stok dan
// harga beli → akun kasir dan dua mekanik. Sesi browser setiap akun disimpan untuk skenario
// berikutnya.

import { type Browser, type Page, expect, test } from '@playwright/test';
import {
  type Akun,
  JASA,
  KASIR,
  MEKANIK,
  MEKANIK_LAIN,
  OUTLET,
  PART,
  PEMILIK,
  SESI_KASIR,
  SESI_MEKANIK,
  SESI_MEKANIK_LAIN,
  SESI_PEMILIK,
  SETUP_TOKEN,
  baris,
  kosongkanData,
  masuk,
  partDariSku,
  rupiah,
  toast,
} from './pembantu';

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  kosongkanData();
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

test('server kosong membuka halaman pemasangan dan pemilik pertama dibuat', async () => {
  await page.goto('/admin/masuk');
  // Belum ada akun sama sekali: halaman masuk mengalihkan ke pemasangan awal.
  await expect(page).toHaveURL(/\/admin\/setup$/);
  await expect(page.getByRole('heading', { name: 'Pemasangan awal' })).toBeVisible();

  await page.getByLabel('Token pemasangan').fill(SETUP_TOKEN);
  await page.getByLabel('Nama pemilik').fill(PEMILIK.nama);
  await page.getByLabel('Email').fill(PEMILIK.email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PEMILIK.sandi);
  await page.getByLabel('Ulangi kata sandi').fill(PEMILIK.sandi);
  await page.getByRole('button', { name: 'Buat akun pemilik' }).click();

  // Sesudah pemasangan, pemilik langsung diarahkan mengisi profil bengkel.
  await expect(page).toHaveURL(/\/admin\/outlet$/);
  await expect(page.getByRole('heading', { name: 'Outlet', level: 1 })).toBeVisible();
  await page.context().storageState({ path: SESI_PEMILIK });

  // Pemasangan hanya sekali: halaman setup sekarang mengalihkan ke halaman masuk.
  const lain = await page.context().browser()!.newPage();
  await lain.goto('/admin/setup');
  await expect(lain).toHaveURL(/\/admin\/masuk$/);
  await lain.close();
});

test('pemilik mengisi profil outlet', async () => {
  await page.goto('/admin/outlet');
  await page.getByLabel('Nama bengkel').fill(OUTLET.nama);
  await page.getByLabel('Tagline').fill(OUTLET.tagline);
  await page.getByLabel('Nomor WhatsApp').fill(OUTLET.hp);
  await page.getByLabel('Alamat').fill(OUTLET.alamat);
  await page.getByLabel('Jam buka').fill(OUTLET.jamBuka);
  await page.getByLabel('Kaki nota').fill(OUTLET.kakiNota);
  await page.getByRole('button', { name: 'Simpan profil' }).click();
  await expect(toast(page)).toHaveText(/Profil bengkel disimpan/);

  // Tersimpan di backend: dimuat ulang, isinya tetap.
  await page.reload();
  await expect(page.getByLabel('Nama bengkel')).toHaveValue(OUTLET.nama);
  await expect(page.getByLabel('Nomor WhatsApp')).toHaveValue(OUTLET.hp);
  await expect(page.getByLabel('Jam buka')).toHaveValue(OUTLET.jamBuka);
});

async function tambahJasa(j: { nama: string; harga: number; durasi: string; deskripsi: string }, opsi: { tampil: boolean; aktif: boolean }) {
  await page.getByRole('button', { name: 'Tambah jasa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tambah jasa' });
  await dialog.getByLabel('Nama jasa').fill(j.nama);
  // Kotak rupiah memberi titik ribuan sambil diketik.
  await dialog.getByLabel('Harga').fill(String(j.harga));
  await expect(dialog.getByLabel('Harga')).toHaveValue(rupiah(j.harga).slice(2));
  await dialog.getByLabel('Durasi (menit)').fill(j.durasi);
  await dialog.getByLabel('Deskripsi').fill(j.deskripsi);
  await dialog.getByLabel('Tampil di website dan bisa dipilih saat booking').setChecked(opsi.tampil);
  await dialog.getByLabel('Aktif (bisa dipakai di SPK baru)').setChecked(opsi.aktif);
  await dialog.getByRole('button', { name: 'Tambah jasa' }).click();
  await expect(dialog).toBeHidden();
  await expect(toast(page)).toHaveText(`Jasa ${j.nama} disimpan.`);
}

test('pemilik menambah jasa: satu tampil di website, satu disembunyikan, satu nonaktif', async () => {
  await page.goto('/admin/jasa');
  await expect(page.getByText('Belum ada jasa. Tambahkan jasa pertama.')).toBeVisible();
  await tambahJasa(JASA.publik, { tampil: true, aktif: true });
  await tambahJasa(JASA.tersembunyi, { tampil: false, aktif: true });
  await tambahJasa(JASA.nonaktif, { tampil: true, aktif: false });

  await expect(baris(page, JASA.publik.nama)).toContainText(rupiah(JASA.publik.harga));
  await expect(baris(page, JASA.publik.nama)).toContainText('Tampil');
  await expect(baris(page, JASA.publik.nama)).toContainText('Aktif');
  await expect(baris(page, JASA.tersembunyi.nama)).toContainText('Disembunyikan');
  await expect(baris(page, JASA.nonaktif.nama)).toContainText('Nonaktif');
});

test('pemilik menambah sparepart dengan stok awal dan harga beli', async () => {
  await page.goto('/admin/sparepart');
  for (const p of Object.values(PART)) {
    await page.getByRole('button', { name: 'Tambah sparepart' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tambah sparepart' });
    await dialog.getByLabel('SKU').fill(p.sku);
    await dialog.getByLabel('Satuan').fill(p.satuan);
    await dialog.getByLabel('Nama sparepart').fill(p.nama);
    await dialog.getByLabel('Harga jual').fill(String(p.harga));
    await dialog.getByLabel('Harga beli').fill(String(p.beli));
    await dialog.getByLabel('Stok minimum').fill('1');
    await dialog.getByLabel('Stok awal').fill(String(p.stok));
    await dialog.getByRole('button', { name: 'Tambah sparepart' }).click();
    await expect(dialog).toBeHidden();
    const b = baris(page, p.nama);
    await expect(b).toContainText(rupiah(p.harga));
    await expect(b).toContainText(rupiah(p.beli));
    await expect(b).toContainText(`${p.stok} ${p.satuan}`);
  }
  // Pemilik melihat harga beli di API juga; kasir dan mekanik tidak (skenario akses).
  const oli = await partDariSku(page, PART.oli.sku);
  expect(oli.stock).toBe(PART.oli.stok);
  expect(oli.costPrice).toBe(PART.oli.beli);
});

async function tambahStaf(akun: Akun, peran: 'Kasir' | 'Mekanik') {
  await page.getByRole('button', { name: 'Tambah staf' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tambah staf' });
  await dialog.getByLabel('Nama').fill(akun.nama);
  await dialog.getByLabel('Email').fill(akun.email);
  await dialog.getByLabel('Kata sandi', { exact: true }).fill(akun.sandi);
  await dialog.getByLabel('Peran').selectOption({ label: peran });
  await dialog.getByRole('button', { name: 'Tambah staf' }).click();
  await expect(dialog).toBeHidden();
  await expect(toast(page)).toHaveText(`Akun ${akun.nama} disimpan.`);
  await expect(baris(page, akun.nama)).toContainText(peran);
}

// Setiap akun masuk di jendela browser sendiri, lalu sesinya disimpan untuk skenario berikutnya.
async function simpanSesi(browser: Browser, akun: Akun, berkas: string) {
  const konteks = await browser.newContext();
  const p = await konteks.newPage();
  await masuk(p, akun);
  await konteks.storageState({ path: berkas });
  await konteks.close();
}

test('pemilik membuat akun kasir dan dua mekanik, lalu masing-masing bisa masuk', async ({ browser }) => {
  await page.goto('/admin/staf');
  await tambahStaf(KASIR, 'Kasir');
  await tambahStaf(MEKANIK, 'Mekanik');
  await tambahStaf(MEKANIK_LAIN, 'Mekanik');

  await simpanSesi(browser, KASIR, SESI_KASIR);
  await simpanSesi(browser, MEKANIK, SESI_MEKANIK);
  await simpanSesi(browser, MEKANIK_LAIN, SESI_MEKANIK_LAIN);
});
