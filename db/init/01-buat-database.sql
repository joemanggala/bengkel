-- Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
-- Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

-- Dijalankan image mysql (sebagai root) hanya saat volume datanya masih kosong, yaitu saat
-- kontainer pertama kali dibuat. User "bengkel" sudah dibuat lebih dulu oleh image lewat
-- MYSQL_USER/MYSQL_PASSWORD.
--
-- "bengkel" untuk dev. Tiga database lainnya khusus tes kontrak, satu per backend (Go,
-- Laravel, NestJS), supaya ketiga suite bisa berjalan bersamaan. Isinya dikosongkan sebelum
-- setiap berkas tes, jadi tidak boleh sama dengan database dev. Charset dan collation ditulis
-- eksplisit supaya tidak bergantung pada bawaan server. Database E2E dan review dibuat oleh
-- bagian yang memakainya.
CREATE DATABASE IF NOT EXISTS bengkel CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS bengkel_uji CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS bengkel_uji_laravel CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS bengkel_uji_nestjs CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON bengkel.* TO 'bengkel'@'%';
GRANT ALL PRIVILEGES ON bengkel_uji.* TO 'bengkel'@'%';
GRANT ALL PRIVILEGES ON bengkel_uji_laravel.* TO 'bengkel'@'%';
GRANT ALL PRIVILEGES ON bengkel_uji_nestjs.* TO 'bengkel'@'%';
