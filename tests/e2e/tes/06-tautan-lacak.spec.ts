// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Tautan lacak dibuat ulang (mis. karena tersebar ke orang lain): tautan lama langsung tidak
// berlaku dan menampilkan pesan, tautan baru bekerja, dan nota WhatsApp membawa tautan baru.
// Tautan di kartu WhatsApp, tombol Salin, Buka, dan nota cetak sama persis dengan tautan di pesan
// WhatsApp ({PUBLIC_WEB_URL}/servis/<token>), juga saat panel dibuka lewat alamat lain.

import { type Locator, type Page, expect, test } from '@playwright/test';
import {
  ALAMAT,
  KASIR,
  OUTLET,
  PART,
  PELANGGAN,
  SESI_KASIR,
  bacaData,
  kartu,
  masuk,
  nilaiDl,
  rupiah,
  simpanData,
  tautanDariPesan,
  toast,
  tungguPesanWa,
} from './pembantu';

test.describe.configure({ mode: 'serial' });

let kasir: Page;

test.beforeAll(async ({ browser }) => {
  const konteks = await browser.newContext({ storageState: SESI_KASIR });
  await konteks.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ALAMAT.web });
  kasir = await konteks.newPage();
});

// Tautan yang tampil di kartu, yang disalin tombol Salin, yang dibuka tombol Buka, dan yang
// tercetak di nota harus sama persis dengan `harapan` (tautan dari pesan WhatsApp).
async function cekTautanSama(page: Page, harapan: string, salin: boolean): Promise<void> {
  const wa: Locator = kartu(page, 'WhatsApp dan tautan lacak');
  await expect(wa.locator('[data-tautan-lacak]')).toHaveText(harapan);
  await expect(wa.getByRole('link', { name: 'Buka', exact: true })).toHaveAttribute('href', harapan);
  await expect(page.locator('#area-cetak')).toContainText('Nota online:');
  await expect(page.locator('#area-cetak p', { hasText: '/servis/' })).toHaveText(harapan);
  if (salin) {
    await wa.getByRole('button', { name: 'Salin', exact: true }).click();
    await expect(toast(page)).toHaveText('Tautan lacak disalin.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(harapan);
  }
}

test.afterAll(async () => {
  await kasir.context().close();
});

test('buat ulang tautan lacak: tautan lama tidak berlaku, tautan baru bekerja', async ({ browser }) => {
  const { spkBooking, tautanLacak: lama } = bacaData();
  await kasir.goto(`/admin/spk/${spkBooking}`);
  const wa = kartu(kasir, 'WhatsApp dan tautan lacak');
  await expect(wa.getByText(lama!, { exact: true })).toBeVisible();

  await wa.getByRole('button', { name: 'Buat ulang' }).click();
  const dialog = kasir.getByRole('dialog', { name: 'Buat ulang tautan lacak?' });
  await dialog.getByRole('button', { name: 'Buat tautan baru' }).click();
  await expect(toast(kasir)).toHaveText('Tautan lacak baru dibuat. Tautan lama tidak berlaku lagi.');
  await expect(wa.getByText(lama!, { exact: true })).toHaveCount(0);
  const baru = tautanDariPesan((await wa.getByText(/\/servis\//).textContent()) ?? '');
  expect(baru).not.toBe(lama);
  simpanData({ tautanLacak: baru });

  const hp = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await hp.goto(lama!);
  await expect(hp.getByRole('heading', { name: 'Tautan lacak tidak berlaku' })).toBeVisible();
  await expect(hp.getByText('Tautan ini salah, terpotong, atau sudah diganti bengkel.')).toBeVisible();
  await expect(hp.locator('body')).not.toContainText(PELANGGAN.booking.nama);

  await hp.goto(baru);
  await expect(hp.getByText(`SPK ${spkBooking}`, { exact: true })).toBeVisible();
  await expect(hp.locator('[data-status="PICKED_UP"]')).toHaveText('Diambil');
  await expect(nilaiDl(hp.getByRole('region', { name: 'Rincian biaya' }), 'Sisa')).toHaveText('Rp0');
  await hp.context().close();
});

test('nota WhatsApp yang dikirim sesudahnya membawa tautan baru', async () => {
  const { tautanLacak } = bacaData();
  const nota = kartu(kasir, 'WhatsApp dan tautan lacak').getByRole('listitem').filter({ hasText: 'Nota' });
  await nota.getByRole('button', { name: 'Kirim', exact: true }).click();
  await expect(toast(kasir)).toHaveText('Pesan "Nota" terkirim.');
  await expect(nota).toContainText('Terkirim');
  // Pesan ke-4 untuk pelanggan ini: konfirmasi booking, SPK dibuat, siap diambil, nota.
  const pesan = await tungguPesanWa(PELANGGAN.booking.wa, 4);
  const isi = pesan[3]!.pesan;
  expect(isi).toContain('Status: Diambil');
  expect(isi).toContain('Sisa: Rp0');
  expect(isi).toContain(OUTLET.kakiNota);
  // Harga beli tidak pernah ada di nota.
  expect(isi).not.toContain(rupiah(PART.oli.beli));
  expect(tautanDariPesan(isi)).toBe(tautanLacak);
  // Kartu, Salin, Buka, dan nota cetak memakai tautan yang persis sama dengan pesan ini.
  await cekTautanSama(kasir, tautanDariPesan(isi), true);
});

test('panel yang dibuka lewat alamat lain tetap memakai PUBLIC_WEB_URL untuk tautan lacak', async ({ browser }) => {
  // Web yang sama lewat 127.0.0.1: tanpa PUBLIC_WEB_URL di web, tautan di nota akan ikut alamat
  // browser ini dan berbeda dengan tautan di pesan WhatsApp (localhost).
  const { spkBooking, tautanLacak } = bacaData();
  expect(ALAMAT.webLain).not.toBe(ALAMAT.web);
  const lain = await (await browser.newContext({ baseURL: ALAMAT.webLain })).newPage();
  await masuk(lain, KASIR);
  await lain.goto(`/admin/spk/${spkBooking}`);
  await expect(lain).toHaveURL(`${ALAMAT.webLain}/admin/spk/${spkBooking}`);
  await cekTautanSama(lain, tautanLacak!, false);
  expect(tautanLacak!.startsWith(`${ALAMAT.web}/servis/`)).toBe(true);
  await expect(kartu(lain, 'WhatsApp dan tautan lacak')).not.toContainText(ALAMAT.webLain);
  await lain.context().close();
});
