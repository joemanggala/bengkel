-- Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
-- Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

-- Hanya untuk MySQL 8 yang dipasang sendiri, TANPA Docker. Pemakai Docker tidak perlu berkas
-- ini, karena db/init dijalankan otomatis oleh kontainer MySQL.
--
-- Jalankan sekali sebagai root, salah satu caranya:
--   - buka berkas ini di MySQL Workbench atau HeidiSQL, lalu jalankan semuanya;
--   - dari folder paket: mysql -u root -p -e "source db/tanpa-docker.sql"
--
-- Hasilnya sama dengan database Docker paket ini: database bengkel, user bengkel, sandi
-- bengkel. Sandi sederhana ini hanya untuk laptop; di server pakai sandi acak sesuai Panduan
-- Upload ke VPS. Sesudahnya, buat tabelnya dengan perintah migrasi backend (lihat README).
--
-- MariaDB, termasuk "MySQL" bawaan XAMPP, tidak bisa dipakai: collation utf8mb4_0900_ai_ci
-- dan REGEXP_LIKE di CHECK migration hanya ada di MySQL 8.
CREATE DATABASE IF NOT EXISTS bengkel CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Dua host, karena koneksi ke 127.0.0.1 dikenali MySQL sebagai 'localhost' atau '127.0.0.1'
-- tergantung pengaturan server.
CREATE USER IF NOT EXISTS 'bengkel'@'localhost' IDENTIFIED BY 'bengkel';
CREATE USER IF NOT EXISTS 'bengkel'@'127.0.0.1' IDENTIFIED BY 'bengkel';
GRANT ALL PRIVILEGES ON bengkel.* TO 'bengkel'@'localhost';
GRANT ALL PRIVILEGES ON bengkel.* TO 'bengkel'@'127.0.0.1';
