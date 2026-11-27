<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Migrasi;

use App\Support\Config\Settings;
use App\Support\Database\SqlError;
use Illuminate\Support\ConfigurationUrlParser;
use PDO;
use Pdo\Mysql as PdoMysql;
use PDOException;
use RuntimeException;
use Throwable;

/**
 * Menjalankan berkas db/migrations tanpa Docker (php artisan bengkel:migrate).
 *
 * Catatan versinya sama persis dengan golang-migrate (alat migrasi di
 * Docker) yang dipakai "docker compose run --rm migrate-dev up": tabel
 * schema_migrations berisi satu baris (version bigint, dirty boolean).
 * Urutan kerjanya juga sama: versi ditandai kotor, isi berkas dijalankan,
 * lalu tanda kotor dilepas. Karena itu database yang dimigrasi lewat Docker
 * bisa dilanjutkan dengan perintah ini, dan sebaliknya.
 *
 * Hanya arah naik (up) yang disediakan. Turun versi tetap lewat Docker atau
 * golang-migrate, karena di laptop cara termudah memulai ulang adalah
 * menghapus database lalu menjalankan migrasi dari awal.
 *
 * Kelas ini memuat berkas dan membuka koneksi; pekerjaan di database
 * dilakukan Pelaksana.
 */
final class Migrasi
{
    /** Pola nama berkas golang-migrate: {versi}_{judul}.up.sql. */
    private const POLA_NAMA = '/^([0-9]+)_(.+)\.up\.sql$/D';

    /**
     * Nilai bawaan koneksi bila tidak disebut di DATABASE_URL, sama dengan
     * config/database.php (mis. port 3306 bila URL tidak menyebut port).
     */
    private const KONEKSI_BAWAAN = [
        'host' => '127.0.0.1',
        'port' => '3306',
        'database' => '',
        'username' => '',
        'password' => '',
        'unix_socket' => '',
    ];

    /**
     * sql_mode yang dipasang Laravel untuk MySQL 8 saat 'strict' => true di
     * config/database.php; sama juga dengan bawaan MySQL 8. Dipasang
     * eksplisit supaya hasil migrasi tidak bergantung pada my.ini server.
     */
    private const SQL_MODE = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

    /** Batas waktu menyambung ke MySQL, dalam detik. */
    private const BATAS_SAMBUNG = 10;

    /** Versi MySQL terendah: CHECK baru ditegakkan mulai 8.0.16 (lihat periksaVersiServer). */
    private const VERSI_MYSQL_MINIMAL = [8, 0, 16];

    /**
     * Membaca semua berkas *.up.sql di $dir, diurutkan menurut versi. Berkas
     * lain (.down.sql, README, cadangan .bak) diabaikan.
     *
     * @return non-empty-list<Berkas>
     *
     * @throws RuntimeException folder tidak bisa dibaca, versi ganda, atau tidak ada berkas
     */
    public static function muat(string $dir): array
    {
        if (! is_dir($dir)) {
            throw new RuntimeException(sprintf('folder migrasi "%s" tidak bisa dibaca: %s',
                $dir, file_exists($dir) ? 'bukan folder' : 'folder tidak ada'));
        }
        $entri = @scandir($dir);
        if ($entri === false) {
            throw new RuntimeException(sprintf('folder migrasi "%s" tidak bisa dibaca: %s',
                $dir, error_get_last()['message'] ?? 'galat tidak dikenal'));
        }
        $daftar = [];
        $dipakai = [];
        foreach ($entri as $nama) {
            $path = $dir.DIRECTORY_SEPARATOR.$nama;
            if (preg_match(self::POLA_NAMA, $nama, $m) !== 1 || is_dir($path)) {
                continue;
            }
            $versi = self::bacaVersi($m[1]);
            if ($versi === null) {
                throw new RuntimeException(sprintf('versi di nama berkas %s tidak sah', $nama));
            }
            if (isset($dipakai[$versi])) {
                throw new RuntimeException(sprintf('versi %d dipakai dua berkas: %s dan %s', $versi, $dipakai[$versi], $nama));
            }
            $dipakai[$versi] = $nama;
            $isi = @file_get_contents($path);
            if ($isi === false) {
                throw new RuntimeException(sprintf('berkas %s tidak bisa dibaca: %s', $nama, error_get_last()['message'] ?? 'galat tidak dikenal'));
            }
            $daftar[] = new Berkas($versi, $nama, $isi);
        }
        if ($daftar === []) {
            throw new RuntimeException(sprintf('tidak ada berkas *.up.sql di "%s"; atur --dir ke folder db/migrations paket ini', $dir));
        }
        usort($daftar, fn (Berkas $a, Berkas $b): int => $a->versi <=> $b->versi);

        return $daftar;
    }

    /**
     * Bilangan bulat desimal (boleh bertanda dan berawalan nol, mis. 000007)
     * yang muat di int 64-bit, atau null.
     */
    public static function bacaVersi(string $teks): ?int
    {
        if (preg_match('/^([+-]?)0*([0-9]+)$/D', $teks, $m) !== 1) {
            return null;
        }
        $angka = $m[2];
        $batas = (string) PHP_INT_MAX;
        if (strlen($angka) > strlen($batas) || (strlen($angka) === strlen($batas) && strcmp($angka, $batas) > 0)) {
            return null;
        }

        return $m[1] === '-' ? -(int) $angka : (int) $angka;
    }

    /**
     * Membuka koneksi untuk migrasi dari DATABASE_URL yang sama dengan
     * backend. URL diuraikan dengan pengurai Laravel yang juga dipakai
     * config/database.php, jadi user, sandi ber-escape URL (%40), host, port,
     * dan nama database terbaca persis seperti saat backend menyala.
     *
     * Bedanya dengan koneksi backend: prepared statement diemulasikan dan
     * multi-statement dinyalakan, karena satu berkas migrasi berisi banyak
     * pernyataan SQL yang dikirim sekaligus. Server yang bukan MySQL 8
     * ditolak sebelum collation utf8mb4_0900_ai_ci dipasang, supaya pemakai
     * MariaDB (mis. dari XAMPP) langsung tahu sebabnya, bukan menerima galat
     * collation di tengah jalan.
     *
     * @throws RuntimeException DATABASE_URL tidak sah, koneksi gagal (dengan petunjuk), atau server bukan MySQL 8
     */
    public static function buka(string $databaseUrl): PDO
    {
        if (! Settings::isDatabaseUrl($databaseUrl)) {
            throw new RuntimeException(Settings::DATABASE_URL_INVALID);
        }
        $c = (new ConfigurationUrlParser)->parseConfiguration(['url' => $databaseUrl] + self::KONEKSI_BAWAAN);
        $socket = (string) ($c['unix_socket'] ?? '');
        $dsn = $socket !== ''
            ? sprintf('mysql:unix_socket=%s;dbname=%s;charset=utf8mb4', $socket, (string) $c['database'])
            : sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', (string) $c['host'], (string) $c['port'], (string) $c['database']);
        try {
            $pdo = new PdoMysql($dsn, (string) ($c['username'] ?? ''), (string) ($c['password'] ?? ''), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_EMULATE_PREPARES => true,
                PDO::ATTR_STRINGIFY_FETCHES => false,
                PDO::ATTR_TIMEOUT => self::BATAS_SAMBUNG,
                PdoMysql::ATTR_MULTI_STATEMENTS => true,
            ]);
        } catch (PDOException $e) {
            throw self::jelaskanGalatKoneksi($e);
        }
        self::periksaVersiServer((string) $pdo->query('SELECT VERSION()')->fetchColumn());
        // Pengaturan sesi sama dengan koneksi backend (config/database.php):
        // utf8mb4 dengan collation skema, zona waktu UTC, dan mode ketat.
        $pdo->exec("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_0900_ai_ci', time_zone = '+00:00', SESSION sql_mode = '".self::SQL_MODE."'");

        return $pdo;
    }

    /**
     * Menolak MariaDB dan MySQL di bawah 8.0.16. Skema memakai collation
     * utf8mb4_0900_ai_ci, CHECK, dan DEFAULT berupa ekspresi, yang hanya ada
     * di MySQL 8. CHECK sendiri baru DITEGAKKAN mulai 8.0.16: versi 8.0
     * yang lebih lama menerima sintaksnya tetapi diam-diam mengabaikannya,
     * jadi aturan bisnis yang dijaga database (total SPK, stok tidak
     * negatif, SPK diambil harus lunas) tidak berlaku tanpa ada galat.
     *
     * @param  string  $versi  hasil SELECT VERSION(), mis. "8.4.10" atau "10.4.32-MariaDB"
     *
     * @throws RuntimeException
     */
    public static function periksaVersiServer(string $versi): void
    {
        if (str_contains(strtolower($versi), 'mariadb')) {
            throw new RuntimeException(sprintf('server database ini MariaDB (%s), bukan MySQL. Aplikasi ini butuh MySQL 8; '
                .'MySQL bawaan XAMPP sebenarnya MariaDB dan tidak bisa dipakai', $versi));
        }
        // "8.0.36", "8.4.10-log", "8.0.15-0ubuntu0.18.04.1": cukup tiga angka
        // pertama. Bagian yang tidak ditulis dianggap 0.
        if (preg_match('/^([0-9]+)(?:\.([0-9]+))?(?:\.([0-9]+))?(?![0-9])/', $versi, $m) !== 1) {
            throw new RuntimeException(sprintf('versi server database "%s" tidak dikenali', $versi));
        }
        $angka = [(int) $m[1], (int) ($m[2] ?? 0), (int) ($m[3] ?? 0)];
        if ($angka < self::VERSI_MYSQL_MINIMAL) {
            throw new RuntimeException(sprintf('server database MySQL %s terlalu lama; butuh MySQL 8.0.16 ke atas (disarankan 8.4), '
                .'karena aturan CHECK di skema baru ditegakkan mulai MySQL 8.0.16', $versi));
        }
    }

    /**
     * Menambahkan petunjuk untuk galat yang paling sering dialami saat
     * memasang MySQL sendiri. Sandi tidak pernah ikut dalam pesan galat PDO,
     * jadi pesan aslinya aman ditampilkan. Galat asli tetap bisa dibaca
     * lewat getPrevious().
     */
    public static function jelaskanGalatKoneksi(Throwable $e): Throwable
    {
        $jalankanSql = 'bila memakai MySQL tanpa Docker, jalankan dulu db/tanpa-docker.sql sebagai root';
        $pesan = $e->getMessage();
        $petunjuk = match (true) {
            SqlError::errno($e) === 1045 => 'user atau sandi di DATABASE_URL ditolak MySQL; '.$jalankanSql,
            SqlError::errno($e) === 1049 => 'database belum dibuat; '.$jalankanSql,
            stripos($pesan, 'refused') !== false => 'MySQL belum menyala, atau port di DATABASE_URL salah '
                .'(MySQL Docker paket ini memakai 3350, MySQL yang dipasang biasa umumnya 3306)',
            // Di Linux dan macOS, PHP menyambung ke host "localhost" lewat
            // soket, bukan TCP, dan letak soketnya belum tentu sama dengan
            // milik MySQL.
            SqlError::errno($e) === 2002 && stripos($pesan, 'No such file') !== false => 'MySQL belum menyala, atau PHP tidak menemukan soket MySQL; '
                .'tulis host 127.0.0.1, bukan localhost, di DATABASE_URL',
            default => null,
        };

        return $petunjuk === null ? $e : new RuntimeException($pesan."\nPetunjuk: ".$petunjuk, 0, $e);
    }
}
