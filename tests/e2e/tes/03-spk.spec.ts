// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Perjalanan SPK dari booking (S-0001) sampai kendaraan diambil: kasir menambah part (stok
// berkurang), part melebihi stok ditolak, SPK pelanggan datang langsung (S-0002) untuk mekanik
// lain, mekanik hanya melihat SPK miliknya dan mengubah status Dikerjakan → Menunggu part →
// Dikerjakan → Selesai, WhatsApp "siap diambil" tiba, pelanggan membuka tautan lacak, Diambil
// ditolak sebelum lunas, bayar sebagian lalu lunas, Diambil, dan rekap pemilik cocok dengan
// hitungan ulang di tes (termasuk modal dan laba kotor).

import { type Browser, type Page, expect, test } from '@playwright/test';
import {
  JASA,
  KASIR,
  MEKANIK,
  MEKANIK_LAIN,
  OUTLET,
  PART,
  PELANGGAN,
  SESI_KASIR,
  SESI_MEKANIK,
  SESI_PEMILIK,
  bacaData,
  baris,
  bffJson,
  kartu,
  nilaiDl,
  panggilBff,
  partDariSku,
  rupiah,
  simpanData,
  tanggalWib,
  tautanDariPesan,
  toast,
  tungguPesanWa,
} from './pembantu';

test.describe.configure({ mode: 'serial' });

const P = PELANGGAN.booking;
const D = PELANGGAN.datang;

// Hitungan uang S-0001 ditulis ulang dari aturan (docs/rancangan.md): total = subtotal jasa +
// subtotal part; laba kotor = total − modal part (harga beli disalin ke item saat ditambahkan).
const JUMLAH_OLI = 2;
// Jasa yang disembunyikan dari website tetap bisa dipakai kasir di SPK, dengan harga khusus untuk
// SPK ini saja (harga katalog tidak berubah).
const HARGA_KHUSUS = 120_000;
const SUBTOTAL_JASA = JASA.publik.harga + HARGA_KHUSUS;
const SUBTOTAL_PART = JUMLAH_OLI * PART.oli.harga + PART.kampas.harga;
const TOTAL = SUBTOTAL_JASA + SUBTOTAL_PART;
const MODAL = JUMLAH_OLI * PART.oli.beli + PART.kampas.beli;
const BAYAR_PERTAMA = 100_000;

let pemilik: Page;
let kasir: Page;
let mekanik: Page;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  pemilik = await (await browser.newContext({ storageState: SESI_PEMILIK })).newPage();
  kasir = await (await browser.newContext({ storageState: SESI_KASIR })).newPage();
  mekanik = await (await browser.newContext({ storageState: SESI_MEKANIK })).newPage();
});

test.afterAll(async () => {
  for (const p of [pemilik, kasir, mekanik]) await p.context().close();
});

async function bukaTambahItem(page: Page, nomor: string) {
  await page.getByRole('button', { name: 'Tambah item' }).click();
  return page.getByRole('dialog', { name: `Tambah item ke ${nomor}` });
}

async function tambahPart(page: Page, nomor: string, part: { sku: string; nama: string }, jumlah: number) {
  const dialog = await bukaTambahItem(page, nomor);
  await dialog.getByRole('button', { name: 'Sparepart', exact: true }).click();
  await dialog.getByLabel('Cari sparepart').fill(part.sku);
  await dialog.getByRole('button', { name: new RegExp(part.nama) }).click();
  await expect(dialog.getByText(`Dipilih: ${part.nama}`)).toBeVisible();
  await dialog.getByLabel('Jumlah').fill(String(jumlah));
  await dialog.getByRole('button', { name: 'Tambah item' }).click();
  return dialog;
}

test('kasir menambah jasa dengan harga khusus; jasa nonaktif tidak bisa dipilih', async () => {
  const { spkBooking } = bacaData();
  await kasir.goto(`/admin/spk/${spkBooking}`);
  const dialog = await bukaTambahItem(kasir, spkBooking!);
  const pilihan = dialog.getByLabel('Jasa', { exact: true });
  // Urutan tampil sama (0), jadi diurutkan menurut nama.
  await expect(pilihan.locator('option')).toHaveText([
    'Pilih jasa',
    `${JASA.tersembunyi.nama} · ${rupiah(JASA.tersembunyi.harga)}`,
    `${JASA.publik.nama} · ${rupiah(JASA.publik.harga)}`,
  ]);
  await pilihan.selectOption({ label: `${JASA.tersembunyi.nama} · ${rupiah(JASA.tersembunyi.harga)}` });
  // Harga katalog terisi otomatis, lalu diganti untuk SPK ini.
  await expect(dialog.getByLabel('Harga per satuan')).toHaveValue(rupiah(JASA.tersembunyi.harga).slice(2));
  await dialog.getByLabel('Harga per satuan').fill(String(HARGA_KHUSUS));
  await dialog.getByRole('button', { name: 'Tambah item' }).click();
  await expect(dialog).toBeHidden();
  await expect(baris(kasir, JASA.tersembunyi.nama)).toContainText(rupiah(HARGA_KHUSUS));
});

test('kasir menambah sparepart ke SPK dan stok berkurang', async () => {
  const { spkBooking } = bacaData();
  await kasir.goto(`/admin/spk/${spkBooking}`);
  const dialog = await tambahPart(kasir, spkBooking!, PART.oli, JUMLAH_OLI);
  await expect(dialog).toBeHidden();
  await expect(baris(kasir, PART.oli.nama)).toContainText(rupiah(JUMLAH_OLI * PART.oli.harga));

  // Stok berkurang di halaman Sparepart pemilik dan di API.
  await pemilik.goto('/admin/sparepart');
  await expect(baris(pemilik, PART.oli.nama)).toContainText(`${PART.oli.stok - JUMLAH_OLI} ${PART.oli.satuan}`);
  // Kasir tidak menerima harga beli sama sekali (bukan null, bukan 0).
  const dilihatKasir = await partDariSku(kasir, PART.oli.sku);
  expect(dilihatKasir.stock).toBe(PART.oli.stok - JUMLAH_OLI);
  expect(dilihatKasir).not.toHaveProperty('costPrice');
});

test('part melebihi stok ditolak dan stok tidak berubah', async () => {
  const { spkBooking } = bacaData();
  const dialog = await tambahPart(kasir, spkBooking!, PART.kampas, PART.kampas.stok + 1);
  await expect(dialog).toContainText(
    `Stok sparepart tidak cukup: ${PART.kampas.nama} (butuh ${PART.kampas.stok + 1} ${PART.kampas.satuan}, tersedia ${PART.kampas.stok} ${PART.kampas.satuan})`,
  );
  await expect(dialog).toBeVisible();
  // Jumlah dibetulkan di dialog yang sama, lalu berhasil.
  await dialog.getByLabel('Jumlah').fill('1');
  await dialog.getByRole('button', { name: 'Tambah item' }).click();
  await expect(dialog).toBeHidden();
  await expect(baris(kasir, PART.kampas.nama)).toContainText(rupiah(PART.kampas.harga));
  expect((await partDariSku(kasir, PART.kampas.sku)).stock).toBe(PART.kampas.stok - 1);

  await expect(nilaiDl(kasir, 'Jasa').first()).toHaveText(rupiah(SUBTOTAL_JASA));
  await expect(nilaiDl(kasir, 'Sparepart').first()).toHaveText(rupiah(SUBTOTAL_PART));
  await expect(nilaiDl(kasir, 'Total').first()).toHaveText(rupiah(TOTAL));
});

test('kasir membuat SPK untuk pelanggan yang datang langsung, ditugaskan ke mekanik lain', async () => {
  await kasir.goto('/admin/spk/baru');
  await kasir.getByRole('button', { name: 'Pelanggan baru' }).click();
  const dPelanggan = kasir.getByRole('dialog', { name: 'Tambah pelanggan' });
  await dPelanggan.getByLabel('Nama').fill(D.nama);
  await dPelanggan.getByLabel('Nomor HP (WhatsApp)').fill(D.hp);
  await dPelanggan.getByRole('button', { name: 'Tambah pelanggan' }).click();

  const dKendaraan = kasir.getByRole('dialog', { name: 'Tambah kendaraan' });
  await dKendaraan.getByLabel('Jenis kendaraan').selectOption({ label: 'Mobil' });
  await dKendaraan.getByLabel('Plat nomor').fill(D.plat);
  await dKendaraan.getByLabel('Merek').fill(D.merek);
  await dKendaraan.getByLabel('Tipe').fill(D.tipe);
  await dKendaraan.getByRole('button', { name: 'Tambah kendaraan' }).click();
  await expect(dKendaraan).toBeHidden();

  await kasir.getByLabel('Keluhan').fill('AC kurang dingin.');
  await kasir.getByLabel('Mekanik').selectOption({ label: MEKANIK_LAIN.nama });
  await kasir.getByRole('button', { name: 'Buat SPK' }).click();
  await expect(kasir).toHaveURL(/\/admin\/spk\/S-0002$/);
  await expect(nilaiDl(kasir, 'Mekanik')).toHaveText(MEKANIK_LAIN.nama);
  const [pesan] = await tungguPesanWa(D.wa, 1);
  expect(pesan!.pesan).toContain(`Kendaraan: ${D.plat} (${D.merek} ${D.tipe})`);
  simpanData({ spkDatang: 'S-0002' });
});

test('mekanik hanya melihat SPK yang ditugaskan kepadanya', async () => {
  const { spkBooking, spkDatang } = bacaData();
  await mekanik.goto('/admin/papan');
  await expect(mekanik.getByRole('link', { name: new RegExp(spkBooking!) })).toBeVisible();
  await expect(mekanik.getByRole('link', { name: new RegExp(spkDatang!) })).toHaveCount(0);
  // Uang tidak tampil di kartu papan mekanik.
  await expect(mekanik.getByRole('link', { name: new RegExp(spkBooking!) })).not.toContainText('Rp');
  // SPK milik mekanik lain: halaman mengalihkan dengan penjelasan, API menolak 403.
  await mekanik.goto(`/admin/spk/${spkDatang}`);
  await expect(mekanik).toHaveURL(/\/admin\/papan\?akses=ditolak$/);
  await expect(mekanik.getByText('Halaman tadi tidak tersedia untuk peranmu')).toBeVisible();
  expect((await panggilBff(mekanik, 'GET', `/staf/work-orders/${spkDatang}`)).status).toBe(403);
  const daftar = await bffJson<{ data: { number: string }[] }>(mekanik, '/staf/work-orders?scope=active');
  expect(daftar.badan.data.map((s) => s.number)).toEqual([spkBooking]);
});

test('mekanik mengubah status sampai Selesai dan WhatsApp siap diambil tiba', async () => {
  const { spkBooking } = bacaData();
  await mekanik.goto(`/admin/spk/${spkBooking}`);
  await expect(mekanik.getByRole('heading', { name: `SPK ${spkBooking}`, level: 1 })).toBeVisible();
  // Mekanik tidak bisa menambah item atau mencatat pembayaran.
  await expect(mekanik.getByRole('button', { name: 'Tambah item' })).toHaveCount(0);
  await expect(mekanik.getByRole('heading', { name: 'Pembayaran' })).toHaveCount(0);

  const langkah: [string, string, string][] = [
    ['Mulai kerjakan', 'Dikerjakan', 'IN_PROGRESS'],
    ['Menunggu part', 'Menunggu part', 'WAITING_PARTS'],
    ['Lanjut dikerjakan', 'Dikerjakan', 'IN_PROGRESS'],
    ['Tandai selesai', 'Selesai', 'DONE'],
  ];
  for (const [tombol, label, status] of langkah) {
    if (tombol === 'Menunggu part') await mekanik.getByLabel('Catatan perubahan status').fill('Menunggu kampas dari pemasok');
    await mekanik.getByRole('button', { name: tombol, exact: true }).click();
    await expect(toast(mekanik)).toHaveText(`Status menjadi ${label}.`);
    await expect(mekanik.locator(`[data-status="${status}"]`).first()).toHaveText(label);
  }
  await expect(mekanik.getByText('Pekerjaan selesai. Kasir yang menyerahkan kendaraan setelah lunas.')).toBeVisible();

  const pesan = await tungguPesanWa(P.wa, 3);
  const isi = pesan[2]!.pesan;
  const { tautanLacak } = bacaData();
  expect(isi).toBe(
    [
      OUTLET.nama,
      `SPK ${spkBooking}`,
      '',
      `Halo ${P.nama}, servis ${P.plat} sudah selesai dan kendaraan siap diambil.`,
      '',
      `Total: ${rupiah(TOTAL)}`,
      'Dibayar: Rp0',
      `Sisa: ${rupiah(TOTAL)}`,
      '',
      'Rincian dan nota:',
      tautanLacak,
      '',
      `Jam buka: ${OUTLET.jamBuka}`,
    ].join('\n'),
  );
  expect(tautanDariPesan(isi)).toBe(tautanLacak);
});

test('pelanggan membuka tautan lacak dan melihat rincian serta total', async ({ browser }) => {
  const { tautanLacak, spkBooking } = bacaData();
  const hp = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await hp.goto(tautanLacak!);
  await expect(hp.getByText(`SPK ${spkBooking}`, { exact: true })).toBeVisible();
  await expect(hp.getByRole('heading', { level: 1 })).toHaveText(`${P.plat} (${P.merek} ${P.tipe})`);
  await expect(hp.locator('[data-status="DONE"]')).toHaveText('Selesai');
  await expect(hp.getByText('Servis selesai. Kendaraan siap diambil setelah lunas.')).toBeVisible();
  const rincian = hp.getByRole('region', { name: 'Rincian biaya' });
  for (const nama of [JASA.publik.nama, PART.oli.nama, PART.kampas.nama]) await expect(rincian).toContainText(nama);
  await expect(nilaiDl(rincian, 'Total')).toHaveText(rupiah(TOTAL));
  await expect(nilaiDl(rincian, 'Terbayar')).toHaveText('Rp0');
  await expect(nilaiDl(rincian, 'Sisa')).toHaveText(rupiah(TOTAL));
  // Halaman publik tidak memuat harga beli maupun nomor HP utuh.
  await expect(hp.locator('body')).not.toContainText(rupiah(PART.oli.beli));
  await expect(hp.locator('body')).not.toContainText(P.wa);
  await hp.context().close();
});

test('Diambil ditolak sebelum lunas, lalu bayar sebagian, lunas, dan diambil', async () => {
  const { spkBooking } = bacaData();
  await kasir.goto(`/admin/spk/${spkBooking}`);
  await expect(kasir.getByText('Belum bayar', { exact: true }).first()).toBeVisible();
  // Tombol dikunci dengan penjelasan, dan API juga menolak bila dipaksa.
  await expect(kasir.getByRole('button', { name: 'Serahkan kendaraan' })).toBeDisabled();
  await expect(kasir.getByText('Lunasi tagihan dulu sebelum kendaraan diserahkan.')).toBeVisible();
  const paksa = await panggilBff(kasir, 'POST', `/staf/work-orders/${spkBooking}/status`, { status: 'PICKED_UP', note: '' });
  expect(paksa).toEqual({ status: 409, kode: 'not_paid_off' });

  const bayar = kartu(kasir, 'Pembayaran');
  // Jumlah bayar terisi sisa tagihan; kasir menggantinya untuk uang muka.
  await expect(bayar.getByLabel('Jumlah bayar')).toHaveValue(rupiah(TOTAL).slice(2));
  await bayar.getByLabel('Jumlah bayar').fill(String(BAYAR_PERTAMA));
  await bayar.getByLabel('Metode').selectOption({ label: 'Tunai' });
  await bayar.getByLabel('Uang diterima').fill('150000');
  await expect(bayar.getByText(`Kembalian ${rupiah(150_000 - BAYAR_PERTAMA)}`)).toBeVisible();
  await bayar.getByRole('button', { name: 'Catat pembayaran' }).click();
  await expect(toast(kasir)).toHaveText(`Pembayaran dicatat. Sisa ${rupiah(TOTAL - BAYAR_PERTAMA)}.`);
  await expect(kasir.getByText('Bayar sebagian', { exact: true }).first()).toBeVisible();
  await expect(kasir.getByRole('button', { name: 'Serahkan kendaraan' })).toBeDisabled();

  await expect(bayar.getByLabel('Jumlah bayar')).toHaveValue(rupiah(TOTAL - BAYAR_PERTAMA).slice(2));
  await bayar.getByLabel('Metode').selectOption({ label: 'QRIS' });
  await bayar.getByRole('button', { name: 'Catat pembayaran' }).click();
  await expect(toast(kasir)).toHaveText(`Pembayaran dicatat. SPK ${spkBooking} lunas.`);
  await expect(kasir.getByText('Lunas', { exact: true }).first()).toBeVisible();

  await kasir.getByRole('button', { name: 'Serahkan kendaraan' }).click();
  await expect(toast(kasir)).toHaveText('Status menjadi Diambil.');
  await expect(kasir.getByText('Kendaraan sudah diambil. SPK ini selesai.')).toBeVisible();
  // Linimasa staf mencatat siapa yang mengubah status, beserta catatannya.
  const linimasa = kartu(kasir, 'Linimasa');
  await expect(linimasa.getByRole('listitem')).toHaveCount(6);
  await expect(linimasa.getByRole('listitem').last()).toContainText(`Diambil`);
  await expect(linimasa.getByRole('listitem').last()).toContainText(KASIR.nama);
  await expect(linimasa).toContainText(MEKANIK.nama);
  await expect(linimasa).toContainText('Menunggu kampas dari pemasok');
});

interface Rekap {
  workOrderCount: number;
  doneCount: number;
  pickedUpCount: number;
  cancelledCount: number;
  serviceTotal: number;
  partTotal: number;
  salesTotal: number;
  partCostTotal: number;
  grossProfit: number;
  paymentTotal: number;
  paymentsByMethod: Record<'cash' | 'transfer' | 'qris', number>;
  topParts: { name: string; quantity: number; revenue: number; cost: number; profit: number }[];
}

test('rekap pemilik cocok dengan hitungan ulang, termasuk modal dan laba kotor', async () => {
  await pemilik.goto('/admin/rekap');
  const { status, badan } = await bffJson<{ data: Rekap }>(pemilik, `/staf/reports/daily?date=${tanggalWib()}`);
  expect(status).toBe(200);
  const r = badan.data;
  expect(r).toMatchObject({
    workOrderCount: 2,
    doneCount: 1,
    pickedUpCount: 1,
    cancelledCount: 0,
    serviceTotal: SUBTOTAL_JASA,
    partTotal: SUBTOTAL_PART,
    salesTotal: TOTAL,
    partCostTotal: MODAL,
    grossProfit: TOTAL - MODAL,
    paymentTotal: TOTAL,
    paymentsByMethod: { cash: BAYAR_PERTAMA, transfer: 0, qris: TOTAL - BAYAR_PERTAMA },
  });
  expect(r.topParts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: PART.oli.nama, quantity: JUMLAH_OLI, revenue: JUMLAH_OLI * PART.oli.harga, cost: JUMLAH_OLI * PART.oli.beli }),
      expect.objectContaining({ name: PART.kampas.nama, quantity: 1, revenue: PART.kampas.harga, cost: PART.kampas.beli }),
    ]),
  );

  // Angka yang sama tampil di halaman Rekap.
  const angka = (label: string) => pemilik.getByText(label, { exact: true }).first().locator('xpath=ancestor::div[2]');
  await expect(angka('Uang diterima')).toContainText(rupiah(TOTAL));
  await expect(angka('Nilai SPK selesai')).toContainText(rupiah(TOTAL));
  await expect(angka('Nilai SPK selesai')).toContainText(`Jasa ${rupiah(SUBTOTAL_JASA)} · Part ${rupiah(SUBTOTAL_PART)}`);
  await expect(angka('Laba kotor')).toContainText(rupiah(TOTAL - MODAL));
  await expect(angka('Laba kotor')).toContainText(`Modal part ${rupiah(MODAL)}`);
  await expect(angka('SPK')).toContainText('1 selesai');
  await expect(angka('SPK')).toContainText('2 masuk · 1 diambil · 0 batal');
  await expect(baris(pemilik, MEKANIK.nama)).toContainText('1');
  await expect(baris(pemilik, PART.oli.nama)).toContainText(rupiah(JUMLAH_OLI * (PART.oli.harga - PART.oli.beli)));
});
