// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// SPK dibatalkan dengan alasan: sparepart yang sudah terpakai di SPK itu kembali ke stok (tercatat
// di kartu stok sebagai "Dikembalikan dari SPK"), SPK tidak bisa dibayar lagi, dan pelanggan
// melihat alasannya di halaman lacak.

import { type Page, expect, test } from '@playwright/test';
import {
  PART,
  PELANGGAN,
  SESI_KASIR,
  SESI_PEMILIK,
  bacaData,
  baris,
  kartu,
  partDariSku,
  panggilBff,
  pesanWa,
  tautanDariPesan,
  toast,
} from './pembantu';

test.describe.configure({ mode: 'serial' });

const ALASAN = 'Pelanggan memutuskan servis di lain waktu.';
// Stok sebelum skenario ini: 10 − 2 dan 3 − 1 terpakai di SPK booking yang sudah diambil.
const STOK_OLI = PART.oli.stok - 2;
const STOK_KAMPAS = PART.kampas.stok - 1;

let pemilik: Page;
let kasir: Page;

test.beforeAll(async ({ browser }) => {
  pemilik = await (await browser.newContext({ storageState: SESI_PEMILIK })).newPage();
  kasir = await (await browser.newContext({ storageState: SESI_KASIR })).newPage();
});

test.afterAll(async () => {
  await pemilik.context().close();
  await kasir.context().close();
});

async function tambahPart(nomor: string, part: { sku: string; nama: string }, jumlah: number) {
  await kasir.getByRole('button', { name: 'Tambah item' }).click();
  const dialog = kasir.getByRole('dialog', { name: `Tambah item ke ${nomor}` });
  await dialog.getByRole('button', { name: 'Sparepart', exact: true }).click();
  await dialog.getByLabel('Cari sparepart').fill(part.sku);
  await dialog.getByRole('button', { name: new RegExp(part.nama) }).click();
  await dialog.getByLabel('Jumlah').fill(String(jumlah));
  await dialog.getByRole('button', { name: 'Tambah item' }).click();
  await expect(dialog).toBeHidden();
}

test('SPK dibatalkan dengan alasan dan semua sparepartnya kembali ke stok', async () => {
  const { spkDatang } = bacaData();
  await kasir.goto(`/admin/spk/${spkDatang}`);
  // Stok kampas habis sama sekali karena SPK ini.
  await tambahPart(spkDatang!, PART.kampas, STOK_KAMPAS);
  await tambahPart(spkDatang!, PART.oli, 1);
  expect((await partDariSku(kasir, PART.kampas.sku)).stock).toBe(0);
  expect((await partDariSku(kasir, PART.oli.sku)).stock).toBe(STOK_OLI - 1);

  await kasir.getByRole('button', { name: 'Batalkan SPK' }).click();
  const dialog = kasir.getByRole('dialog', { name: `Batalkan SPK ${spkDatang}?` });
  await dialog.getByLabel('Alasan batal').fill(ALASAN);
  await dialog.getByRole('button', { name: 'Batalkan SPK' }).click();
  await expect(dialog).toBeHidden();
  await expect(toast(kasir)).toHaveText(`SPK ${spkDatang} dibatalkan.`);
  await expect(kasir.getByText(`SPK dibatalkan. Alasan: ${ALASAN}`)).toBeVisible();
  // SPK batal tidak bisa ditambah item atau dibayar.
  await expect(kasir.getByRole('button', { name: 'Tambah item' })).toHaveCount(0);
  await expect(kartu(kasir, 'Pembayaran').getByRole('button', { name: 'Catat pembayaran' })).toHaveCount(0);
  expect(await panggilBff(kasir, 'POST', `/staf/work-orders/${spkDatang}/payments`, { amount: 1000, method: 'cash' })).toMatchObject({ status: 409 });

  // Stok kembali seperti sebelum SPK ini.
  await pemilik.goto('/admin/sparepart');
  await expect(baris(pemilik, PART.kampas.nama)).toContainText(`${STOK_KAMPAS} ${PART.kampas.satuan}`);
  await expect(baris(pemilik, PART.oli.nama)).toContainText(`${STOK_OLI} ${PART.oli.satuan}`);

  // Kartu stok mencatat pemakaian dan pengembaliannya, dengan nomor SPK.
  await pemilik.getByRole('button', { name: `Kartu stok ${PART.kampas.nama}` }).click();
  const kartuStok = pemilik.getByRole('dialog', { name: `Kartu stok ${PART.kampas.nama}` });
  const kembali = baris(kartuStok, 'Dikembalikan dari SPK');
  await expect(kembali).toHaveCount(1);
  await expect(kembali).toContainText(`+${STOK_KAMPAS}`);
  await expect(kembali).toContainText(spkDatang!);
  await expect(baris(kartuStok, 'Terpakai SPK')).toHaveCount(2);
  await expect(baris(kartuStok, 'Stok awal')).toContainText(`+${PART.kampas.stok}`);
});

test('pelanggan melihat SPK dibatalkan beserta alasannya di halaman lacak', async ({ browser }) => {
  const [pesan] = await pesanWa(PELANGGAN.datang.wa);
  const hp = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await hp.goto(tautanDariPesan(pesan!.pesan));
  await expect(hp.locator('[data-status="CANCELLED"]')).toHaveText('Dibatalkan');
  await expect(hp.getByText('SPK ini dibatalkan bengkel.')).toBeVisible();
  await expect(hp.getByText(`Alasan: ${ALASAN}`)).toBeVisible();
  await hp.context().close();
});
