// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Booking yang tidak jadi: kasir menolak booking dengan alasan (WhatsApp penolakan tiba, alasan
// tampil di halaman booking pelanggan), dan pelanggan membatalkan bookingnya sendiri (tanpa
// WhatsApp; staf tidak bisa lagi mengonfirmasinya).

import { type Browser, type Page, expect, test } from '@playwright/test';
import { ALAMAT, OUTLET, PELANGGAN, SESI_KASIR, nilaiDl, panggilBff, tanggalTampil, tanggalWib, toast, tungguPesanWa } from './pembantu';

test.describe.configure({ mode: 'serial' });

const ALASAN = 'Bengkel tutup tanggal itu, silakan pilih tanggal lain.';
const TANGGAL = tanggalWib(2);

let browser: Browser;
let kasir: Page;

test.beforeAll(async ({ browser: b }) => {
  browser = b;
  kasir = await (await browser.newContext({ storageState: SESI_KASIR })).newPage();
});

test.afterAll(async () => {
  await kasir.context().close();
});

// Pelanggan booking dari HP tanpa memilih jasa. Mengembalikan halaman status bookingnya.
async function booking(p: { nama: string; hp: string; plat: string; merek: string; tipe: string }): Promise<Page> {
  const hp = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await hp.goto('/');
  await hp.getByRole('link', { name: 'Booking servis' }).first().click();
  await expect(hp).toHaveURL(/\/booking$/);
  await hp.getByLabel('Nama').fill(p.nama);
  await hp.getByLabel('Nomor WhatsApp').fill(p.hp);
  await hp.locator('label', { hasText: /^Motor$/ }).click();
  await hp.getByLabel('Plat nomor').fill(p.plat);
  await hp.getByLabel('Merek').fill(p.merek);
  if (p.tipe) await hp.getByLabel('Tipe').fill(p.tipe);
  await hp.getByLabel('Tanggal datang').fill(TANGGAL);
  await hp.getByLabel('Keluhan').fill('Servis rutin.');
  await hp.getByRole('button', { name: 'Kirim booking' }).click();
  await expect(hp).toHaveURL(/\/booking\/[A-Za-z0-9_-]{43}$/);
  await expect(hp.locator('[data-status="PENDING"]')).toHaveText('Menunggu');
  await expect(nilaiDl(hp, 'Jasa')).toHaveText('Belum memilih jasa');
  return hp;
}

test('kasir menolak booking dengan alasan, WhatsApp penolakan tiba, dan pelanggan melihat alasannya', async () => {
  const P = PELANGGAN.ditolak;
  const hp = await booking(P);
  await expect(hp.getByRole('heading', { name: 'Booking B-0002' })).toBeVisible();

  await kasir.goto('/admin/booking');
  await kasir.getByRole('link', { name: 'B-0002' }).click();
  await kasir.getByRole('button', { name: 'Tolak', exact: true }).click();
  const dialog = kasir.getByRole('dialog', { name: 'Tolak booking B-0002?' });
  // Alasan wajib diisi.
  await dialog.getByRole('button', { name: 'Tolak booking' }).click();
  await expect(dialog.getByLabel('Alasan tolak')).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel('Alasan tolak').fill(ALASAN);
  await dialog.getByRole('button', { name: 'Tolak booking' }).click();
  await expect(dialog).toBeHidden();
  await expect(toast(kasir)).toHaveText('Booking B-0002 ditolak.');
  await expect(kasir.locator('[data-status="REJECTED"]')).toHaveText('Ditolak');
  await expect(kasir.getByText(`Alasan: ${ALASAN}`)).toBeVisible();
  await expect(kasir.getByRole('button', { name: 'Jadikan SPK' })).toHaveCount(0);

  const [pesan] = await tungguPesanWa(P.wa, 1);
  expect(pesan!.pesan).toBe(
    [
      OUTLET.nama,
      'Booking B-0002',
      '',
      `Halo, mohon maaf, booking servis kamu untuk ${P.plat} pada ${tanggalTampil(TANGGAL)} belum bisa kami terima.`,
      '',
      `Alasan: ${ALASAN}`,
      '',
      `Silakan booking ulang di ${ALAMAT.web}/booking`,
    ].join('\n'),
  );

  await hp.reload();
  await expect(hp.locator('[data-status="REJECTED"]')).toHaveText('Ditolak');
  await expect(hp.getByText(`Alasan: ${ALASAN}`)).toBeVisible();
  await expect(hp.getByRole('button', { name: 'Batalkan booking' })).toHaveCount(0);
  await hp.context().close();
});

test('pelanggan membatalkan bookingnya sendiri dan kasir tidak bisa mengonfirmasinya lagi', async () => {
  const P = PELANGGAN.batal;
  const hp = await booking(P);
  await expect(hp.getByRole('heading', { name: 'Booking B-0003' })).toBeVisible();
  await expect(nilaiDl(hp, 'Kendaraan')).toHaveText(`Motor · ${P.plat} · ${P.merek}`);

  await hp.getByRole('button', { name: 'Batalkan booking' }).click();
  const dialog = hp.getByRole('dialog', { name: 'Batalkan booking B-0003?' });
  await dialog.getByRole('button', { name: 'Batalkan booking' }).click();
  await expect(toast(hp)).toHaveText('Booking dibatalkan.');
  await expect(hp.locator('[data-status="CANCELLED"]')).toHaveText('Dibatalkan');
  await expect(hp.getByText('Booking ini sudah kamu batalkan.')).toBeVisible();
  await expect(hp.getByRole('button', { name: 'Batalkan booking' })).toHaveCount(0);

  // Booking yang dibatalkan pelanggan hilang dari tab Menunggu kasir.
  await kasir.goto('/admin/booking');
  await expect(kasir.getByRole('link', { name: 'B-0001' })).toHaveCount(0);
  await expect(kasir.getByText('Tidak ada booking yang menunggu konfirmasi.')).toBeVisible();
  await kasir.getByRole('button', { name: 'Dibatalkan' }).click();
  await kasir.getByRole('link', { name: 'B-0003' }).click();
  await expect(kasir.getByText('Booking dibatalkan pelanggan.')).toBeVisible();
  await expect(kasir.getByRole('button', { name: 'Konfirmasi', exact: true })).toHaveCount(0);
  const id = kasir.url().split('/').pop();
  expect(await panggilBff(kasir, 'POST', `/staf/bookings/${id}/confirm`)).toMatchObject({ status: 409 });

  // Pembatalan oleh pelanggan tidak mengirim WhatsApp.
  await tungguPesanWa(P.wa, 0);
  await hp.context().close();
});
