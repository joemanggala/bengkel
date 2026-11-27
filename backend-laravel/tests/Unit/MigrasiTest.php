<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Migrasi\Berkas;
use App\Support\Migrasi\Migrasi;
use App\Support\Migrasi\MigrasiKotor;
use PDOException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * Bagian bengkel:migrate yang tidak butuh database: membaca folder migrasi,
 * memeriksa versi server, dan petunjuk galat koneksi. Migrasi terhadap MySQL
 * sungguhan ada di tests/Feature/MigrasiMySqlTest.php.
 */
final class MigrasiTest extends TestCase
{
    /** @var list<string> folder sementara yang dihapus sesudah tiap tes */
    private array $folder = [];

    protected function tearDown(): void
    {
        foreach ($this->folder as $dir) {
            foreach (glob($dir.'/*') ?: [] as $berkas) {
                unlink($berkas);
            }
            rmdir($dir);
        }
        parent::tearDown();
    }

    /** @param  array<string, string>  $isi  nama berkas → isinya */
    private function folderBerisi(array $isi): string
    {
        $dir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'bengkel-migrasi-'.bin2hex(random_bytes(6));
        mkdir($dir);
        $this->folder[] = $dir;
        foreach ($isi as $nama => $teks) {
            file_put_contents($dir.DIRECTORY_SEPARATOR.$nama, $teks);
        }

        return $dir;
    }

    private function galatMuat(string $dir): string
    {
        try {
            Migrasi::muat($dir);
        } catch (RuntimeException $e) {
            return $e->getMessage();
        }
        $this->fail('folder ini seharusnya ditolak: '.$dir);
    }

    public function test_files_are_sorted_by_version_and_other_files_are_ignored(): void
    {
        $dir = $this->folderBerisi([
            '000010_sepuluh.up.sql' => 'SELECT 10;',
            '000002_dua.up.sql' => 'SELECT 2;',
            '000002_dua.down.sql' => 'SELECT -2;',
            '000001_satu.up.sql' => 'SELECT 1;',
            'README.md' => 'bukan migrasi',
            '000003_tiga.up.sql.bak' => 'cadangan',
        ]);

        $daftar = Migrasi::muat($dir);

        $this->assertSame([1, 2, 10], array_map(fn (Berkas $b): int => $b->versi, $daftar));
        $this->assertSame('000002_dua.up.sql', $daftar[1]->nama);
        $this->assertSame('SELECT 2;', $daftar[1]->isi);
    }

    public function test_duplicate_versions_and_empty_or_missing_folders_are_rejected(): void
    {
        $ganda = $this->folderBerisi(['1_a.up.sql' => 'SELECT 1;', '000001_b.up.sql' => 'SELECT 1;']);
        $this->assertSame('versi 1 dipakai dua berkas: 000001_b.up.sql dan 1_a.up.sql', $this->galatMuat($ganda));

        $kosong = $this->folderBerisi(['000001_a.down.sql' => 'SELECT 1;']);
        $this->assertStringContainsString('tidak ada berkas *.up.sql di "'.$kosong.'"', $this->galatMuat($kosong));
        $this->assertStringContainsString('--dir', $this->galatMuat($kosong));

        $this->assertStringContainsString('tidak bisa dibaca: folder tidak ada', $this->galatMuat($kosong.DIRECTORY_SEPARATOR.'tidak-ada'));
        $this->assertStringContainsString('tidak bisa dibaca: bukan folder', $this->galatMuat($kosong.DIRECTORY_SEPARATOR.'000001_a.down.sql'));
    }

    public function test_a_version_too_large_for_64_bits_is_rejected(): void
    {
        $dir = $this->folderBerisi(['99999999999999999999_besar.up.sql' => 'SELECT 1;']);

        $this->assertSame('versi di nama berkas 99999999999999999999_besar.up.sql tidak sah', $this->galatMuat($dir));
    }

    /** Migrasi asli paket harus terbaca tanpa galat dan berurutan tanpa celah. */
    public function test_the_package_migrations_load_in_order_without_gaps(): void
    {
        $daftar = Migrasi::muat(dirname(__DIR__, 3).DIRECTORY_SEPARATOR.'db'.DIRECTORY_SEPARATOR.'migrations');

        foreach ($daftar as $i => $b) {
            $this->assertSame($i + 1, $b->versi, sprintf('berkas ke-%d (%s): versi harus berurutan mulai 1', $i + 1, $b->nama));
            $this->assertStringEndsWith('.up.sql', $b->nama);
        }
    }

    /** @return iterable<string, array{string, ?int}> */
    public static function nomorVersi(): iterable
    {
        yield 'biasa' => ['7', 7];
        yield 'berawalan nol' => ['000007', 7];
        yield 'nol' => ['0', 0];
        yield 'negatif' => ['-1', -1];
        yield 'bertanda plus' => ['+3', 3];
        yield 'batas 64-bit' => ['9223372036854775807', PHP_INT_MAX];
        yield 'lewat batas' => ['9223372036854775808', null];
        yield 'huruf' => ['x7', null];
        yield 'desimal' => ['7.0', null];
        yield 'kosong' => ['', null];
        yield 'spasi' => [' 7', null];
    }

    #[DataProvider('nomorVersi')]
    public function test_version_numbers_are_parsed_like_golang_integers(string $teks, ?int $harapan): void
    {
        $this->assertSame($harapan, Migrasi::bacaVersi($teks));
    }

    /** @return iterable<string, array{string, bool}> */
    public static function versiServer(): iterable
    {
        yield 'MySQL 8.4' => ['8.4.10', true];
        yield 'MySQL 8.0' => ['8.0.36', true];
        yield 'MySQL 9' => ['9.1.0', true];
        yield 'MariaDB XAMPP' => ['10.4.32-MariaDB', false];
        yield 'MariaDB log' => ['11.4.2-MariaDB-log', false];
        yield 'MySQL 5.7' => ['5.7.44', false];
        yield 'tidak dikenal' => ['bukan-versi', false];
    }

    #[DataProvider('versiServer')]
    public function test_only_mysql_8_and_newer_is_accepted(string $versi, bool $boleh): void
    {
        $galat = null;
        try {
            Migrasi::periksaVersiServer($versi);
        } catch (RuntimeException $e) {
            $galat = $e->getMessage();
        }
        $this->assertSame($boleh, $galat === null, sprintf('server %s: boleh = %s, galat = %s', $versi, var_export($boleh, true), $galat ?? '-'));
    }

    public function test_rejection_messages_explain_the_cause(): void
    {
        $pesan = function (string $versi): string {
            try {
                Migrasi::periksaVersiServer($versi);
            } catch (RuntimeException $e) {
                return $e->getMessage();
            }
            $this->fail('server '.$versi.' seharusnya ditolak');
        };

        $this->assertSame('server database ini MariaDB (10.4.32-MariaDB), bukan MySQL. Aplikasi ini butuh MySQL 8; '
            .'MySQL bawaan XAMPP sebenarnya MariaDB dan tidak bisa dipakai', $pesan('10.4.32-MariaDB'));
        $this->assertSame('server database MySQL 5.7.44 terlalu lama; butuh MySQL 8.0 ke atas (disarankan 8.4)', $pesan('5.7.44'));
        $this->assertSame('versi server database "bukan-versi" tidak dikenali', $pesan('bukan-versi'));
    }

    /** Galat saat menyambung tidak membawa errorInfo, hanya kode pada PDOException-nya. */
    private static function galatSambung(int $kode, string $pesan): PDOException
    {
        return new PDOException('SQLSTATE[HY000] ['.$kode.'] '.$pesan, $kode);
    }

    public function test_wrong_password_and_missing_database_point_to_the_setup_script(): void
    {
        $asli = self::galatSambung(1045, "Access denied for user 'bengkel'@'localhost' (using password: YES)");
        $ditolak = Migrasi::jelaskanGalatKoneksi($asli);

        $this->assertSame($asli->getMessage()."\nPetunjuk: user atau sandi di DATABASE_URL ditolak MySQL; "
            .'bila memakai MySQL tanpa Docker, jalankan dulu db/tanpa-docker.sql sebagai root', $ditolak->getMessage());
        $this->assertSame($asli, $ditolak->getPrevious(), 'galat asli harus tetap bisa dibaca');

        $belumAda = Migrasi::jelaskanGalatKoneksi(self::galatSambung(1049, "Unknown database 'bengkel'"));
        $this->assertStringContainsString("\nPetunjuk: database belum dibuat; ", $belumAda->getMessage());
        $this->assertStringContainsString('db/tanpa-docker.sql', $belumAda->getMessage());
    }

    public function test_refused_connection_mentions_both_ports(): void
    {
        $windows = Migrasi::jelaskanGalatKoneksi(self::galatSambung(2002, 'No connection could be made because the target machine actively refused it'));
        $linux = Migrasi::jelaskanGalatKoneksi(self::galatSambung(2002, 'Connection refused'));

        foreach ([$windows, $linux] as $galat) {
            $this->assertStringContainsString("\nPetunjuk: MySQL belum menyala, atau port di DATABASE_URL salah", $galat->getMessage());
            $this->assertStringContainsString('3350', $galat->getMessage());
            $this->assertStringContainsString('3306', $galat->getMessage());
        }
    }

    public function test_missing_socket_for_localhost_suggests_127_0_0_1(): void
    {
        $galat = Migrasi::jelaskanGalatKoneksi(self::galatSambung(2002, 'No such file or directory'));

        $this->assertStringContainsString('tulis host 127.0.0.1, bukan localhost', $galat->getMessage());
    }

    public function test_other_errors_are_returned_unchanged(): void
    {
        $lain = self::galatSambung(2054, 'The server requested authentication method unknown to the client');

        $this->assertSame($lain, Migrasi::jelaskanGalatKoneksi($lain));
    }

    public function test_dirty_message_names_both_ways_out(): void
    {
        $kotor = new MigrasiKotor(3);

        $this->assertSame(3, $kotor->versi);
        $this->assertSame('migrasi versi 3 pernah gagal di tengah jalan (status kotor). '
            .'Perbaiki penyebabnya, lalu jalankan "paksa 3" bila perubahan versi itu sudah lengkap, '
            .'atau "paksa 2" bila belum sama sekali; cara termudah di laptop: hapus database, buat lagi, lalu migrasi dari awal',
            $kotor->getMessage());
    }
}
