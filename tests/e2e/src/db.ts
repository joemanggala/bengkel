// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import mysql from 'mysql2/promise';

// Pengaman: harness mengosongkan semua tabel, jadi hanya database E2E yang boleh disentuh.
const POLA_DATABASE_E2E = /^bengkel_e2e_(go|laravel|nestjs)$/;

// Sama dengan daftar di tests/kontrak/src/db.ts: harus lengkap, karena tabel yang terlewat
// membuat data jalan sebelumnya bocor ke jalan berikutnya.
const TABEL = [
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

// Baris awal yang dibuat migration 000001, dimasukkan lagi persis sama setelah TRUNCATE.
const SQL_BARIS_AWAL = [
  "INSERT INTO outlet (outlet_id, name) VALUES (1, 'Nama Bengkel')",
  "INSERT INTO counters (name, value) VALUES ('work_order_number', 0), ('booking_number', 0)",
];

export function namaDatabase(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

// Mengembalikan database ke keadaan sesudah migration: tanpa staf, sehingga web membuka halaman
// pemasangan awal seperti server yang baru dipasang.
export async function kosongkanDatabase(url: string): Promise<void> {
  const nama = namaDatabase(url);
  if (!POLA_DATABASE_E2E.test(nama)) {
    throw new Error(`Menolak mengosongkan database "${nama}": E2E hanya boleh memakai bengkel_e2e_<backend>`);
  }
  let koneksi: mysql.Connection;
  try {
    koneksi = await mysql.createConnection({ uri: url, timezone: 'Z' });
  } catch (e) {
    throw new Error(`Database E2E ${nama} tidak bisa dihubungi (docker compose up -d mysql?): ${(e as Error).message}`);
  }
  try {
    const [ada] = await koneksi.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name IN (?)',
      [nama, TABEL],
    );
    const jumlah = Number(ada[0]?.n ?? 0);
    if (jumlah !== TABEL.length) {
      throw new Error(`Database ${nama} baru punya ${jumlah} dari ${TABEL.length} tabel; jalankan migration up lebih dulu`);
    }
    // Satu koneksi untuk seluruh langkah: FOREIGN_KEY_CHECKS berlaku per sesi.
    await koneksi.query('SET SESSION lock_wait_timeout = 10');
    await koneksi.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tabel of TABEL) await koneksi.query(`TRUNCATE TABLE \`${tabel}\``);
    for (const sql of SQL_BARIS_AWAL) await koneksi.query(sql);
    await koneksi.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await koneksi.end();
  }
}
