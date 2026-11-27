// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Tautan lacak dibuat ulang (mis. karena tersebar ke orang lain): tautan lama langsung tidak
// berlaku dan menampilkan pesan, tautan baru bekerja, dan nota WhatsApp membawa tautan baru.

import { type Page, expect, test } from '@playwright/test';
import { OUTLET, PART, PELANGGAN, SESI_KASIR, bacaData, kartu, nilaiDl, rupiah, simpanData, tautanDariPesan, toast, tungguPesanWa } from './pembantu';

test.describe.configure({ mode: 'serial' });

let kasir: Page;

test.beforeAll(async ({ browser }) => {
  kasir = await (await browser.newContext({ storageState: SESI_KASIR })).newPage();
});

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
});
