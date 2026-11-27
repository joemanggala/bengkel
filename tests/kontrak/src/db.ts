// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { bacaEnv, samarkanUrl } from './env';

export const NAMA_DATABASE_UJI = 'bengkel_uji';
// bengkel_uji_laravel, bengkel_uji_nestjs, dst.: satu database uji per
// backend, supaya suite ketiga backend bisa berjalan bersamaan tanpa saling
// mengosongkan tabel.
const POLA_DATABASE_UJI = /^bengkel_uji(?:_[a-z0-9]+)?$/;

// Ke-16 tabel migration 000001_awal. Urutan tidak penting karena
// FOREIGN_KEY_CHECKS dimatikan sementara, tetapi daftarnya harus lengkap:
// tabel yang terlewat membuat data bocor antarberkas (mis. kartu stok yang
// tertinggal membuat jumlah kartu tidak lagi sama dengan stok sparepart, dan
// login_attempts yang tertinggal mengunci email uji di berkas berikutnya).
export const TABEL = [
  'wa_messages',
  'bookings',
  'stock_movements',
  'payments',
  'work_order_status_logs',
  'work_order_items',
  'work_orders',
  'counters',
  'parts',
  'services',
  'vehicles',
  'customers',
  'outlet',
  'login_attempts',
  'staff_sessions',
  'staff',
] as const;

export type Tabel = (typeof TABEL)[number];
export type PeranStaf = 'owner' | 'cashier' | 'mechanic';

export function namaDatabase(url: string): string {
  let uraian: URL;
  try {
    uraian = new URL(url);
  } catch {
    throw new Error('DATABASE_URL tidak bisa dibaca sebagai URL mysql://user:sandi@host:port/database');
  }
  if (uraian.protocol !== 'mysql:') {
    throw new Error(`DATABASE_URL harus berawalan mysql://, bukan ${uraian.protocol}//`);
  }
  return decodeURIComponent(uraian.pathname.replace(/^\//, ''));
}

// Pengaman: tes mengosongkan semua tabel. Salah menunjuk ke database dev
// berarti kehilangan data, jadi selain bengkel_uji (dan bengkel_uji_*) selalu
// ditolak.
export function pastikanDatabaseUji(url: string): void {
  const nama = namaDatabase(url);
  if (!POLA_DATABASE_UJI.test(nama)) {
    throw new Error(
      `Menolak memakai database "${nama}" (${samarkanUrl(url)}): tes kontrak hanya boleh mengosongkan "${NAMA_DATABASE_UJI}" atau "${NAMA_DATABASE_UJI}_<nama>"`,
    );
  }
}

let pool: mysql.Pool | undefined;

export function buatPool(url: string): mysql.Pool {
  return mysql.createPool({
    uri: url,
    // DATETIME disimpan UTC; timezone 'Z' membuat mysql2 membacanya sebagai UTC.
    timezone: 'Z',
    // DATE (visit_date) dibaca sebagai teks "YYYY-MM-DD" apa adanya, bukan
    // Date yang bisa bergeser oleh zona waktu mesin.
    dateStrings: ['DATE'],
    connectionLimit: 4,
    supportBigNumbers: true,
    bigNumberStrings: false,
  });
}

export function db(): mysql.Pool {
  if (!pool) {
    const { databaseUrl } = bacaEnv();
    pastikanDatabaseUji(databaseUrl);
    pool = buatPool(databaseUrl);
  }
  return pool;
}

export async function tutupDatabase(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = undefined;
    await p.end();
  }
}

export async function baca<T = any>(sql: string, nilai: unknown[] = []): Promise<T[]> {
  const [baris] = await db().query(sql, nilai);
  return baris as T[];
}

export async function bacaSatu<T = any>(sql: string, nilai: unknown[] = []): Promise<T | undefined> {
  return (await baca<T>(sql, nilai))[0];
}

export async function jalankan(sql: string, nilai: unknown[] = []): Promise<number> {
  const [hasil] = await db().query(sql, nilai);
  return (hasil as mysql.ResultSetHeader).affectedRows;
}

// Baris awal yang dibuat migration 000001. Setelah TRUNCATE, semuanya
// dimasukkan lagi persis sama, karena backend boleh menganggapnya ada.
export const SQL_BARIS_AWAL = [
  "INSERT INTO outlet (outlet_id, name) VALUES (1, 'Nama Bengkel')",
  "INSERT INTO counters (name, value) VALUES ('work_order_number', 0), ('booking_number', 0)",
];

async function kosongkanTabel(koneksi: mysql.PoolConnection, tabel: readonly string[], sesudah: readonly string[]): Promise<void> {
  try {
    // Bawaan lock_wait_timeout MySQL satu tahun. Bila backend menahan
    // transaksi terbuka, lebih baik tes gagal dalam 10 detik daripada menggantung.
    await koneksi.query('SET SESSION lock_wait_timeout = 10');
    await koneksi.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of tabel) {
      await koneksi.query(`TRUNCATE TABLE \`${t}\``);
    }
    for (const sql of sesudah) {
      await koneksi.query(sql);
    }
  } finally {
    await koneksi.query('SET FOREIGN_KEY_CHECKS = 1');
    koneksi.release();
  }
}

export async function kosongkanDatabase(): Promise<void> {
  pastikanDatabaseUji(bacaEnv().databaseUrl);
  // Satu koneksi yang sama untuk seluruh langkah: FOREIGN_KEY_CHECKS berlaku
  // per sesi, jadi mematikannya di koneksi lain tidak berpengaruh.
  await kosongkanTabel(await db().getConnection(), TABEL, SQL_BARIS_AWAL);
}

// Mengosongkan semua SPK dan booking beserta item, pembayaran, linimasa, dan
// pesan WhatsApp-nya, lalu menyetel kedua penghitung nomor ke 0. Staf,
// pelanggan, kendaraan, jasa, dan sparepart tidak disentuh. Dipakai blok tes
// yang membutuhkan nomor mulai S-0001/B-0001 dan daftar yang hanya berisi data
// bloknya sendiri. Tidak untuk berkas yang memakai item sparepart: baris kartu
// stok USED/RETURNED menunjuk ke SPK, dan menghapus SPK-nya membuat jumlah
// kartu tidak lagi sama dengan stok.
export async function kosongkanSpkDanBooking(): Promise<void> {
  pastikanDatabaseUji(bacaEnv().databaseUrl);
  if ((await jumlahBaris('stock_movements', 'work_order_id IS NOT NULL')) > 0) {
    throw new Error('kosongkanSpkDanBooking tidak boleh dipakai berkas yang membuat item sparepart; pakai kosongkanDatabase');
  }
  await kosongkanTabel(
    await db().getConnection(),
    ['wa_messages', 'payments', 'work_order_status_logs', 'work_order_items', 'work_orders', 'bookings'],
    ["UPDATE counters SET value = 0 WHERE name IN ('work_order_number', 'booking_number')"],
  );
}

// Lebih ringan dari kosongkanDatabase, untuk berkas yang perlu tabel staf
// kosong di setiap tes (setup, kelola staf) tetapi tidak membuat SPK, kartu
// stok, atau booking yang ditangani staf.
export async function kosongkanStaf(): Promise<void> {
  pastikanDatabaseUji(bacaEnv().databaseUrl);
  const terpakai =
    (await jumlahBaris('work_orders')) + (await jumlahBaris('stock_movements')) + (await jumlahBaris('bookings', 'handled_by_staff_id IS NOT NULL'));
  if (terpakai > 0) {
    throw new Error('kosongkanStaf hanya untuk berkas tanpa SPK, kartu stok, dan booking yang ditangani staf; pakai kosongkanDatabase');
  }
  await jalankan('DELETE FROM staff_sessions');
  await jalankan('DELETE FROM login_attempts');
  await jalankan('DELETE FROM staff');
}

export function sha256Hex(teks: string | Uint8Array): string {
  return createHash('sha256').update(teks).digest('hex');
}

export async function jumlahBaris(tabel: Tabel, where = '1 = 1', nilai: unknown[] = []): Promise<number> {
  const baris = await bacaSatu<{ n: number }>(`SELECT COUNT(*) AS n FROM \`${tabel}\` WHERE ${where}`, nilai);
  return Number(baris?.n ?? 0);
}

// Jam server database (UTC). Semua penggeseran waktu di harness memakai jam
// ini, bukan jam mesin tes.
export async function waktuDatabase(): Promise<Date> {
  const baris = await bacaSatu<{ sekarang: Date }>('SELECT UTC_TIMESTAMP(3) AS sekarang');
  return baris?.sekarang ?? new Date();
}

// Tanggal WIB (UTC+7 tetap) hari ini menurut jam database, digeser
// `geserHari`, sebagai "YYYY-MM-DD". Untuk visitDate booking dan filter
// tanggal. Hindari tes tepat di sekitar tengah malam WIB (17.00 UTC): jam
// backend dan database bisa berbeda beberapa milidetik.
export async function tanggalWib(geserHari = 0): Promise<string> {
  const baris = await bacaSatu<{ t: string }>(
    "SELECT DATE_FORMAT(DATE_ADD(DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 7 HOUR), INTERVAL ? DAY), '%Y-%m-%d') AS t",
    [geserHari],
  );
  if (!baris) {
    throw new Error('Tanggal WIB tidak bisa dibaca dari database');
  }
  return baris.t;
}

// Peran staf pemilik token saat ini (dari staff_sessions + staff), atau
// undefined bila token tidak dikenal. Dipakai klien untuk memilih skema baris
// daftar sparepart.
export async function peranToken(token: string): Promise<PeranStaf | undefined> {
  const baris = await bacaSatu<{ role: PeranStaf }>(
    'SELECT s.role FROM staff_sessions ss JOIN staff s ON s.staff_id = ss.staff_id WHERE ss.token_hash = ?',
    [sha256Hex(token)],
  );
  return baris?.role;
}

// Staf disisipkan langsung (seperti akun yang dibuat backend lain dengan
// sandi yang sama), supaya tes tidak bergantung pada POST /api/setup.
export async function sisipkanStaf(opsi: {
  name: string;
  email: string;
  role: PeranStaf;
  passwordHash: string;
  aktif?: boolean;
}): Promise<string> {
  const id = randomUUID();
  await jalankan(
    'INSERT INTO staff (staff_id, name, email, password_hash, role, is_active, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 DAY))',
    [id, opsi.name, opsi.email, opsi.passwordHash, opsi.role, opsi.aktif ?? true],
  );
  return id;
}

// Membuat sesi langsung di database dengan aturan bersama (32 byte acak →
// base64url 43 karakter; token_hash = sha256 hex string token), seperti sesi
// yang dibuat backend lain. Backend mana pun wajib menerimanya.
export async function sisipkanSesi(staffId: string, opsi: { kedaluwarsaDetik?: number } = {}): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await jalankan(
    'INSERT INTO staff_sessions (staff_session_id, staff_id, token_hash, created_at, expires_at, last_used_at) ' +
      'VALUES (?, ?, ?, UTC_TIMESTAMP(3), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND), UTC_TIMESTAMP(3))',
    [randomUUID(), staffId, sha256Hex(token), opsi.kedaluwarsaDetik ?? 24 * 60 * 60],
  );
  return token;
}

// Semua penggeseran waktu memakai UTC_TIMESTAMP(3) milik server database,
// supaya tidak bergantung pada jam atau zona waktu mesin yang menjalankan tes.
export async function geserSesi(token: string, opsi: { kedaluwarsaDetik: number; terakhirDipakaiDetikLalu: number }): Promise<void> {
  const jumlah = await jalankan(
    'UPDATE staff_sessions SET expires_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND), ' +
      'last_used_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? SECOND) WHERE token_hash = ?',
    [opsi.kedaluwarsaDetik, opsi.terakhirDipakaiDetikLalu, sha256Hex(token)],
  );
  if (jumlah !== 1) {
    throw new Error('Sesi staf untuk token itu tidak ditemukan; apakah token_hash disimpan sebagai sha256 hex?');
  }
}

// Sisa detik sampai sesi habis dan detik sejak terakhir dipakai, dihitung di
// database supaya tidak terpengaruh beda jam antara mesin tes dan MySQL.
export async function waktuSesi(token: string): Promise<{ sisa: number; sejakDipakai: number } | undefined> {
  const baris = await bacaSatu<{ sisa: number; sejakDipakai: number }>(
    'SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(3), expires_at) AS sisa, ' +
      'TIMESTAMPDIFF(SECOND, last_used_at, UTC_TIMESTAMP(3)) AS sejakDipakai FROM staff_sessions WHERE token_hash = ?',
    [sha256Hex(token)],
  );
  return baris ? { sisa: Number(baris.sisa), sejakDipakai: Number(baris.sejakDipakai) } : undefined;
}

export type NamaPenghitung = 'work_order_number' | 'booking_number';

// Menyetel penghitung nomor (mis. 9998 untuk membuktikan S-9999 → S-10000).
export async function aturPenghitung(nama: NamaPenghitung, nilai: number): Promise<void> {
  await jalankan('UPDATE counters SET value = ? WHERE name = ?', [nilai, nama]);
}

export async function nilaiPenghitung(nama: NamaPenghitung): Promise<number> {
  return Number((await bacaSatu<{ value: number }>('SELECT value FROM counters WHERE name = ?', [nama]))?.value);
}

// Mematikan atau menghidupkan baris langsung di database, untuk kasus yang
// sulit dicapai lewat API (mis. mekanik nonaktif yang masih tertera di SPK).
export async function setAktif(tabel: 'services' | 'parts' | 'staff', id: string, aktif: boolean): Promise<void> {
  const kolom = { services: 'service_id', parts: 'part_id', staff: 'staff_id' }[tabel];
  const jumlah = await jalankan(`UPDATE \`${tabel}\` SET is_active = ? WHERE \`${kolom}\` = ?`, [aktif, id]);
  if (jumlah !== 1) {
    throw new Error(`${tabel} ${id} tidak ditemukan`);
  }
}

export async function idSpk(number: string): Promise<string> {
  const baris = await bacaSatu<{ work_order_id: string }>('SELECT work_order_id FROM work_orders WHERE number = ?', [number]);
  if (!baris) {
    throw new Error(`SPK ${number} tidak ada di database`);
  }
  return baris.work_order_id;
}

export async function idBooking(number: string): Promise<string> {
  const baris = await bacaSatu<{ booking_id: string }>('SELECT booking_id FROM bookings WHERE number = ?', [number]);
  if (!baris) {
    throw new Error(`Booking ${number} tidak ada di database`);
  }
  return baris.booking_id;
}

// Baris mentah tabel work_orders, untuk memeriksa kolom yang tidak muncul di
// API (mis. tracking_token yang tersimpan apa adanya, pembuat SPK).
export interface BarisSpk {
  work_order_id: string;
  number: string;
  customer_id: string;
  vehicle_id: string;
  mechanic_staff_id: string | null;
  status: string;
  complaint: string;
  diagnosis: string;
  odometer: number | null;
  estimated_done_at: Date | null;
  service_subtotal: number;
  part_subtotal: number;
  total: number;
  paid_amount: number;
  cancel_reason: string | null;
  tracking_token: string;
  created_by_staff_id: string;
  created_at: Date;
  updated_at: Date;
}

export async function barisSpk(number: string): Promise<BarisSpk> {
  const baris = await bacaSatu<BarisSpk>('SELECT * FROM work_orders WHERE number = ?', [number]);
  if (!baris) {
    throw new Error(`SPK ${number} tidak ada di database`);
  }
  for (const k of ['service_subtotal', 'part_subtotal', 'total', 'paid_amount'] as const) {
    baris[k] = Number(baris[k]);
  }
  return baris;
}

// Baris mentah work_order_items satu SPK, urut line_no. cost_price tidak
// pernah ada di API mana pun, jadi satu-satunya cara membuktikan salinan
// harga beli adalah membaca tabel ini.
export interface BarisItemSpk {
  work_order_item_id: string;
  line_no: number;
  type: 'SERVICE' | 'PART';
  service_id: string | null;
  part_id: string | null;
  item_name: string;
  price: number;
  cost_price: number;
  quantity: number;
  subtotal: number;
  created_by_staff_id: string;
}

export async function barisItemSpk(number: string): Promise<BarisItemSpk[]> {
  const baris = await baca<BarisItemSpk>(
    'SELECT work_order_item_id, line_no, type, service_id, part_id, item_name, price, cost_price, quantity, subtotal, created_by_staff_id ' +
      'FROM work_order_items WHERE work_order_id = ? ORDER BY line_no',
    [await idSpk(number)],
  );
  return baris.map((b) => ({
    ...b,
    line_no: Number(b.line_no),
    price: Number(b.price),
    cost_price: Number(b.cost_price),
    quantity: Number(b.quantity),
    subtotal: Number(b.subtotal),
  }));
}

export interface BarisLogSpk {
  from_status: string | null;
  to_status: string;
  staff_id: string;
  note: string;
  created_at: Date;
}

export async function barisLogSpk(number: string): Promise<BarisLogSpk[]> {
  return baca<BarisLogSpk>(
    'SELECT from_status, to_status, staff_id, note, created_at FROM work_order_status_logs WHERE work_order_id = ? ' +
      'ORDER BY created_at, work_order_status_log_id',
    [await idSpk(number)],
  );
}

// Baris mentah bookings. booking_token_hash = sha256 hex token booking.
export interface BarisBooking {
  booking_id: string;
  number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_type: 'MOTOR' | 'CAR';
  plate_display: string;
  plate_key: string;
  vehicle_brand: string;
  vehicle_model: string;
  service_id: string | null;
  service_name: string | null;
  // DATE dibaca sebagai teks "YYYY-MM-DD" (lihat buatPool).
  visit_date: string;
  complaint: string;
  status: string;
  reject_reason: string | null;
  booking_token_hash: string;
  work_order_id: string | null;
  handled_by_staff_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function barisBooking(number: string): Promise<BarisBooking> {
  const baris = await bacaSatu<BarisBooking>('SELECT * FROM bookings WHERE number = ?', [number]);
  if (!baris) {
    throw new Error(`Booking ${number} tidak ada di database`);
  }
  return baris;
}

// Harga beli, stok, dan stok minimum sparepart saat ini langsung dari
// database: API hanya membuka costPrice untuk pemilik.
export interface BarisPart {
  part_id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
}

export async function barisPart(partId: string): Promise<BarisPart> {
  const b = await bacaSatu<BarisPart>(
    'SELECT part_id, sku, name, unit, price, cost_price, stock, min_stock, is_active FROM parts WHERE part_id = ?',
    [partId],
  );
  if (!b) {
    throw new Error(`Sparepart ${partId} tidak ada di database`);
  }
  return {
    ...b,
    price: Number(b.price),
    cost_price: Number(b.cost_price),
    stock: Number(b.stock),
    min_stock: Number(b.min_stock),
    is_active: Boolean(Number(b.is_active)),
  };
}

export interface BarisKartuStok {
  stock_movement_id: string;
  type: 'IN' | 'OUT' | 'COUNT' | 'USED' | 'RETURNED';
  quantity: number;
  stock_after: number;
  note: string;
  work_order_id: string | null;
  staff_id: string;
  created_at: Date;
}

// Kartu stok satu sparepart, urut dari yang paling lama.
export async function barisKartuStok(partId: string): Promise<BarisKartuStok[]> {
  const baris = await baca<BarisKartuStok>(
    'SELECT stock_movement_id, type, quantity, stock_after, note, work_order_id, staff_id, created_at FROM stock_movements ' +
      'WHERE part_id = ? ORDER BY created_at, stock_movement_id',
    [partId],
  );
  return baris.map((b) => ({ ...b, quantity: Number(b.quantity), stock_after: Number(b.stock_after) }));
}

// Membuktikan aturan "jumlah semua quantity kartu stok sebuah sparepart selalu
// sama dengan stock-nya" untuk semua sparepart. Mengembalikan SKU yang tidak
// cocok (harus kosong).
export async function sparepartTidakCocokKartu(): Promise<string[]> {
  const baris = await baca<{ sku: string }>(
    `SELECT p.sku FROM parts p LEFT JOIN stock_movements m ON m.part_id = p.part_id
     GROUP BY p.part_id, p.sku, p.stock HAVING COALESCE(SUM(m.quantity), 0) <> p.stock ORDER BY p.sku`,
  );
  return baris.map((b) => b.sku);
}

export type JenisWa = 'booking_confirmed' | 'booking_rejected' | 'work_order_created' | 'work_order_done' | 'receipt';

export interface BarisWa {
  wa_message_id: string;
  type: JenisWa;
  phone: string;
  body: string;
  status: 'sent' | 'failed';
  failure_reason: string | null;
  booking_id: string | null;
  work_order_id: string | null;
  created_at: Date;
}

export async function barisWa(where = '1 = 1', nilai: unknown[] = []): Promise<BarisWa[]> {
  return baca<BarisWa>(`SELECT * FROM wa_messages WHERE ${where} ORDER BY created_at, wa_message_id`, nilai);
}

export async function barisWaSpk(nomor: string, jenis?: JenisWa): Promise<BarisWa[]> {
  const id = await idSpk(nomor);
  return jenis ? barisWa('work_order_id = ? AND type = ?', [id, jenis]) : barisWa('work_order_id = ?', [id]);
}

export async function barisWaBooking(nomor: string, jenis?: JenisWa): Promise<BarisWa[]> {
  const id = await idBooking(nomor);
  return jenis ? barisWa('booking_id = ? AND type = ?', [id, jenis]) : barisWa('booking_id = ?', [id]);
}

// --- Penetapan waktu UTC ---------------------------------------------------
// Waktu diberikan sebagai Date, ISO berakhiran Z, atau teks UTC
// "YYYY-MM-DD HH:MM:SS.mmm". Tes tanggal dan rekap tidak boleh bergantung pada
// kecepatan backend menulis created_at.

export function teksUtc(waktu: string | Date): string {
  if (typeof waktu === 'string' && !waktu.endsWith('Z')) {
    return waktu;
  }
  return new Date(waktu).toISOString().replace('T', ' ').replace('Z', '');
}

function wajibSatu(jumlah: number, pesan: string): void {
  if (jumlah !== 1) {
    throw new Error(pesan);
  }
}

// Menetapkan created_at SPK; baris linimasa pertama (null → QUEUED) ikut
// digeser supaya tetap sama dengan waktu SPK dibuat.
export async function aturWaktuSpk(nomor: string, waktuUtc: string | Date): Promise<void> {
  const waktu = teksUtc(waktuUtc);
  wajibSatu(await jalankan('UPDATE work_orders SET created_at = ? WHERE number = ?', [waktu, nomor]), `SPK ${nomor} tidak ditemukan`);
  await jalankan('UPDATE work_order_status_logs SET created_at = ? WHERE from_status IS NULL AND work_order_id = ?', [waktu, await idSpk(nomor)]);
}

// Menetapkan created_at baris linimasa menuju `keStatus` (mis. DONE untuk
// rekap "SPK selesai hari itu"). Gagal bila baris itu tidak tepat satu.
export async function aturWaktuLogSpk(nomor: string, keStatus: string, waktuUtc: string | Date): Promise<void> {
  const jumlah = await jalankan('UPDATE work_order_status_logs SET created_at = ? WHERE work_order_id = ? AND to_status = ?', [
    teksUtc(waktuUtc),
    await idSpk(nomor),
    keStatus,
  ]);
  wajibSatu(jumlah, `Baris linimasa ${keStatus} SPK ${nomor} tidak tepat satu (${jumlah})`);
}

export async function aturWaktuPembayaran(paymentId: string, waktuUtc: string | Date): Promise<void> {
  const jumlah = await jalankan('UPDATE payments SET created_at = ? WHERE payment_id = ?', [teksUtc(waktuUtc), paymentId]);
  wajibSatu(jumlah, `Pembayaran ${paymentId} tidak ditemukan`);
}

export async function aturWaktuBooking(nomor: string, waktuUtc: string | Date): Promise<void> {
  wajibSatu(await jalankan('UPDATE bookings SET created_at = ? WHERE number = ?', [teksUtc(waktuUtc), nomor]), `Booking ${nomor} tidak ditemukan`);
}

// visit_date disimpan sebagai DATE WIB apa adanya. Untuk membuat booking yang
// tanggal datangnya sudah lewat (tidak bisa lewat API).
export async function aturTanggalDatang(nomor: string, tanggal: string): Promise<void> {
  wajibSatu(await jalankan('UPDATE bookings SET visit_date = ? WHERE number = ?', [tanggal, nomor]), `Booking ${nomor} tidak ditemukan`);
}

// Tes urutan daftar: harness menetapkan created_at sendiri. Nomor pertama di
// daftar menjadi yang paling lama, berselang satu jam; linimasa pertama SPK
// ikut digeser.
export async function urutkanSpk(nomorDariTerlama: string[]): Promise<void> {
  for (const [i, nomor] of nomorDariTerlama.entries()) {
    const jumlah = await jalankan('UPDATE work_orders SET created_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR) WHERE number = ?', [
      nomorDariTerlama.length - i,
      nomor,
    ]);
    wajibSatu(jumlah, `SPK ${nomor} tidak ditemukan untuk diatur waktunya`);
    await jalankan(
      'UPDATE work_order_status_logs l JOIN work_orders w ON w.work_order_id = l.work_order_id SET l.created_at = w.created_at ' +
        'WHERE l.from_status IS NULL AND w.number = ?',
      [nomor],
    );
  }
}

export async function urutkanBooking(nomorDariTerlama: string[]): Promise<void> {
  for (const [i, nomor] of nomorDariTerlama.entries()) {
    const jumlah = await jalankan('UPDATE bookings SET created_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR) WHERE number = ?', [
      nomorDariTerlama.length - i,
      nomor,
    ]);
    wajibSatu(jumlah, `Booking ${nomor} tidak ditemukan untuk diatur waktunya`);
  }
}

// Kartu stok: baris pertama di daftar menjadi yang paling lama, berselang satu
// detik (urutan "createdAt terbaru dulu" di GET …/movements).
export async function urutkanKartuStok(movementIdDariTerlama: string[]): Promise<void> {
  for (const [i, id] of movementIdDariTerlama.entries()) {
    const jumlah = await jalankan(
      'UPDATE stock_movements SET created_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? SECOND) WHERE stock_movement_id = ?',
      [movementIdDariTerlama.length - i, id],
    );
    wajibSatu(jumlah, `Kartu stok ${id} tidak ditemukan untuk diatur urutannya`);
  }
}

