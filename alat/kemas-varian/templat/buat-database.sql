-- Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
-- Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

-- Dijalankan image mysql (sebagai root) hanya saat volume datanya masih
-- kosong, yaitu saat kontainer pertama kali dibuat. User "bengkel" sudah
-- dibuat lebih dulu oleh image lewat MYSQL_USER/MYSQL_PASSWORD.
--
-- Database "bengkel" dipakai backend dan web. Charset dan collation ditulis
-- eksplisit supaya tidak bergantung pada bawaan server.
CREATE DATABASE IF NOT EXISTS bengkel CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON bengkel.* TO 'bengkel'@'%';
