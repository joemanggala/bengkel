// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Booking publik: pelanggan membuka website, hanya melihat jasa yang tampil, booking tanpa akun →
// halaman status Menunggu → kasir mengonfirmasi → WhatsApp konfirmasi tiba di WhatsApp palsu →
// kasir menjadikannya SPK (mekanik ditugaskan) → WhatsApp "SPK dibuat" membawa tautan lacak.

import { type Browser, type Page, expect, test } from '@playwright/test';
import {
  JASA,
  MEKANIK,
  OUTLET,
  PELANGGAN,
  SESI_KASIR,
  nilaiDl,
  rupiah,
  simpanData,
  tanggalTampil,
  tanggalWib,
  tautanDariPesan,
  toast,
  tungguPesanWa,
} from './pembantu';

test.describe.configure({ mode: 'serial' });

const P = PELANGGAN.booking;
const TANGGAL = tanggalWib(1);

let pelanggan: Page;
let kasir: Page;
let alamatStatus = '';

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  // Pelanggan memakai HP tanpa sesi staf; kasir memakai sesi dari skenario pemasangan.
  pelanggan = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  kasir = await (await browser.newContext({ storageState: SESI_KASIR })).newPage();
});

test.afterAll(async () => {
  await pelanggan.context().close();
  await kasir.context().close();
});

test('halaman depan hanya menampilkan jasa yang tampil di website dan aktif', async () => {
  await pelanggan.goto('/');
  await expect(pelanggan.getByRole('heading', { name: OUTLET.nama, level: 1 })).toBeVisible();
  await expect(pelanggan.getByText(OUTLET.tagline)).toBeVisible();
  const daftar = pelanggan.getByRole('region', { name: 'Jasa dan harga' });
  await expect(daftar.getByRole('listitem')).toHaveCount(1);
  await expect(daftar).toContainText(JASA.publik.nama);
  await expect(daftar).toContainText(rupiah(JASA.publik.harga));
  await expect(daftar).not.toContainText(JASA.tersembunyi.nama);
  await expect(daftar).not.toContainText(JASA.nonaktif.nama);
});

test('pelanggan booking tanpa akun dan melihat status Menunggu', async () => {
  // Mengetuk jasa di halaman depan membuka form booking dengan jasa itu terpilih.
  await pelanggan.getByRole('region', { name: 'Jasa dan harga' }).getByRole('link', { name: new RegExp(JASA.publik.nama) }).click();
  await expect(pelanggan).toHaveURL(/\/booking\?jasa=/);
  const pilihanJasa = pelanggan.getByLabel('Jasa');
  await expect(pilihanJasa.locator('option:checked')).toHaveText(`${JASA.publik.nama} · ${rupiah(JASA.publik.harga)}`);
  // Hanya jasa publik yang bisa dipilih (ditambah pilihan kosong).
  await expect(pilihanJasa.locator('option')).toHaveText(['Belum memilih jasa', `${JASA.publik.nama} · ${rupiah(JASA.publik.harga)}`]);

  await pelanggan.getByLabel('Nama').fill(P.nama);
  await pelanggan.getByLabel('Nomor WhatsApp').fill(P.hp);
  // Radio disembunyikan (sr-only) dan labelnya tampil sebagai tombol; yang diketuk labelnya.
  await pelanggan.locator('label', { hasText: /^Motor$/ }).click();
  await expect(pelanggan.getByRole('radio', { name: 'Motor' })).toBeChecked();
  await pelanggan.getByLabel('Plat nomor').fill(P.plat.toLowerCase());
  await pelanggan.getByLabel('Merek').fill(P.merek);
  await pelanggan.getByLabel('Tipe').fill(P.tipe);
  await pelanggan.getByLabel('Tanggal datang').fill(TANGGAL);
  await pelanggan.getByLabel('Keluhan').fill('Ganti oli, rem depan agak bunyi.');
  await pelanggan.getByRole('button', { name: 'Kirim booking' }).click();

  await expect(pelanggan).toHaveURL(/\/booking\/[A-Za-z0-9_-]{43}$/);
  alamatStatus = pelanggan.url();
  simpanData({ bookingToken: alamatStatus.split('/').pop() });
  await expect(pelanggan.getByRole('heading', { name: 'Booking B-0001' })).toBeVisible();
  await expect(pelanggan.locator('[data-status="PENDING"]')).toHaveText('Menunggu');
  await expect(nilaiDl(pelanggan, 'Tanggal datang')).toHaveText(tanggalTampil(TANGGAL));
  // Plat diseragamkan, nomor HP disamarkan di halaman publik.
  await expect(nilaiDl(pelanggan, 'Kendaraan')).toHaveText(`Motor · ${P.plat} · ${P.merek} ${P.tipe}`);
  await expect(nilaiDl(pelanggan, 'Nomor WhatsApp')).toHaveText(/^6281\*{4}7890$/);
  await expect(nilaiDl(pelanggan, 'Jasa')).toHaveText(JASA.publik.nama);
  // Booking dari website belum mengirim WhatsApp apa pun.
  await tungguPesanWa(P.wa, 0);
});

test('kasir mengonfirmasi booking dan WhatsApp konfirmasi tiba', async () => {
  await kasir.goto('/admin/booking');
  // Tab bawaan: booking yang Menunggu.
  await expect(kasir.getByRole('button', { name: 'Menunggu', pressed: true })).toBeVisible();
  await kasir.getByRole('link', { name: 'B-0001' }).click();
  await expect(kasir.getByRole('heading', { name: 'Booking B-0001', level: 1 })).toBeVisible();
  await expect(nilaiDl(kasir, 'Pemesan')).toHaveText(P.nama);
  await expect(nilaiDl(kasir, 'Nomor WhatsApp')).toHaveText(P.hp);

  await kasir.getByRole('button', { name: 'Konfirmasi', exact: true }).click();
  await expect(toast(kasir)).toHaveText('Booking B-0001 dikonfirmasi. Pelanggan dikirimi WhatsApp.');
  await expect(kasir.locator('[data-status="CONFIRMED"]')).toHaveText('Dikonfirmasi');

  const [pesan] = await tungguPesanWa(P.wa, 1);
  expect(pesan!.pesan).toBe(
    [
      OUTLET.nama,
      'Booking B-0001',
      '',
      `Halo, booking servis kamu untuk ${P.plat} pada ${tanggalTampil(TANGGAL)} sudah dikonfirmasi.`,
      '',
      `Jasa: ${JASA.publik.nama}`,
      '',
      `Alamat: ${OUTLET.alamat}`,
      `Jam buka: ${OUTLET.jamBuka}`,
    ].join('\n'),
  );

  // Pelanggan memuat ulang halaman statusnya.
  await pelanggan.reload();
  await expect(pelanggan.locator('[data-status="CONFIRMED"]')).toHaveText('Dikonfirmasi');
});

test('kasir menjadikan booking SPK dengan mekanik, dan WhatsApp SPK membawa tautan lacak', async () => {
  await kasir.getByRole('button', { name: 'Jadikan SPK' }).click();
  const dialog = kasir.getByRole('dialog', { name: 'Jadikan SPK dari B-0001' });
  await dialog.getByLabel('Odometer (km)').fill('18250');
  await dialog.getByLabel('Mekanik').selectOption({ label: MEKANIK.nama });
  await dialog.getByRole('button', { name: 'Jadikan SPK' }).click();

  await expect(kasir).toHaveURL(/\/admin\/spk\/S-0001$/);
  await expect(kasir.getByRole('heading', { name: 'SPK S-0001', level: 1 })).toBeVisible();
  await expect(nilaiDl(kasir, 'Mekanik')).toHaveText(MEKANIK.nama);
  await expect(nilaiDl(kasir, 'Dari booking')).toHaveText('B-0001');
  // Jasa yang dipilih saat booking menjadi item pertama.
  await expect(kasir.getByRole('row').filter({ hasText: JASA.publik.nama })).toContainText(rupiah(JASA.publik.harga));

  const pesan = await tungguPesanWa(P.wa, 2);
  const isi = pesan[1]!.pesan;
  expect(isi).toContain('SPK S-0001');
  expect(isi).toContain(`Halo ${P.nama}, kendaraan kamu sudah kami terima untuk diservis.`);
  expect(isi).toContain(`Kendaraan: ${P.plat} (${P.merek} ${P.tipe})`);
  simpanData({ spkBooking: 'S-0001', tautanLacak: tautanDariPesan(isi) });

  await pelanggan.reload();
  await expect(pelanggan.locator('[data-status="CONVERTED"]')).toHaveText('Jadi SPK');
  await expect(pelanggan.getByText('Nomor SPK: S-0001')).toBeVisible();
});
