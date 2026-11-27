-- Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
-- Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

-- Kebalikan dari 000001_awal.up.sql: menghapus semua tabel beserta isinya. Urutan kebalikan
-- dari pembuatan: tabel yang menunjuk tabel lain dihapus lebih dulu supaya tidak ada FOREIGN
-- KEY yang menghalangi.
DROP TABLE IF EXISTS wa_messages;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS work_order_status_logs;
DROP TABLE IF EXISTS work_order_items;
DROP TABLE IF EXISTS work_orders;
DROP TABLE IF EXISTS counters;
DROP TABLE IF EXISTS parts;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS outlet;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS staff_sessions;
DROP TABLE IF EXISTS staff;
