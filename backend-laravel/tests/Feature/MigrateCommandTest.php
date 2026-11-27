<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\Artisan;
use Symfony\Component\Console\Output\BufferedOutput;

/**
 * Perintah bengkel:migrate lewat kernel konsol Laravel, tanpa database: galat
 * argumen dan env muncul sebelum ada koneksi. Env dibaca lewat repositori
 * env Laravel, yang membaca $_SERVER lebih dulu, jadi tes cukup mengubah
 * $_SERVER lalu mengembalikannya.
 */
final class MigrateCommandTest extends TestCase
{
    private const ENV = ['DATABASE_URL', 'PORT', 'SETUP_TOKEN', 'WA_API_URL', 'WA_TOKEN'];

    /** @var array<string, mixed> nilai env asli sebelum tes; nama yang tidak ada tidak tercatat */
    private array $envAsli = [];

    private ?string $folderKosong = null;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (self::ENV as $nama) {
            if (array_key_exists($nama, $_SERVER)) {
                $this->envAsli[$nama] = $_SERVER[$nama];
            }
        }
    }

    protected function tearDown(): void
    {
        foreach (self::ENV as $nama) {
            if (array_key_exists($nama, $this->envAsli)) {
                $_SERVER[$nama] = $this->envAsli[$nama];
            } else {
                unset($_SERVER[$nama]);
            }
        }
        if ($this->folderKosong !== null) {
            rmdir($this->folderKosong);
        }
        parent::tearDown();
    }

    /**
     * @param  array<string, string>  $parameter
     * @return array{int, string} kode keluar dan seluruh keluaran (stdout dan stderr tergabung)
     */
    private function migrate(array $parameter = []): array
    {
        $keluaran = new BufferedOutput;
        $kode = Artisan::call('bengkel:migrate', $parameter, $keluaran);

        // writeln memakai PHP_EOL, yang di Windows berupa CRLF.
        return [$kode, str_replace(PHP_EOL, "\n", $keluaran->fetch())];
    }

    public function test_an_empty_database_url_explains_how_to_create_env(): void
    {
        $_SERVER['DATABASE_URL'] = " \r\n";

        [$kode, $keluaran] = $this->migrate();

        $this->assertSame(1, $kode);
        $this->assertSame('Gagal: DATABASE_URL kosong; salin .env.example menjadi .env di folder backend-laravel, '
            ."lalu jalankan lagi dari folder itu\n", $keluaran);
    }

    public function test_a_malformed_database_url_is_rejected_without_printing_it(): void
    {
        $_SERVER['DATABASE_URL'] = 'postgres://bengkel:rahasia-db@localhost/bengkel';

        [$kode, $keluaran] = $this->migrate(['perintah' => 'versi']);

        $this->assertSame(1, $kode);
        $this->assertStringContainsString('DATABASE_URL harus berbentuk mysql://user:sandi@host:port/database', $keluaran);
        $this->assertStringNotContainsString('rahasia-db', $keluaran);
    }

    /**
     * Hanya DATABASE_URL yang dibutuhkan: env lain yang kosong atau salah
     * tidak menghalangi, supaya tabel bisa dibuat sebelum pengaturan lain
     * diisi. Folder kosong menghentikan perintah sebelum menyambung.
     */
    public function test_only_database_url_is_required(): void
    {
        $_SERVER['DATABASE_URL'] = 'mysql://bengkel:bengkel@127.0.0.1:1/bengkel';
        $_SERVER['PORT'] = 'bukan-port';
        $_SERVER['SETUP_TOKEN'] = 'pendek';
        $_SERVER['WA_API_URL'] = 'salah';
        $_SERVER['WA_TOKEN'] = '';
        $this->folderKosong = sys_get_temp_dir().DIRECTORY_SEPARATOR.'bengkel-migrasi-kosong-'.bin2hex(random_bytes(6));
        mkdir($this->folderKosong);

        [$kode, $keluaran] = $this->migrate(['--dir' => $this->folderKosong]);

        $this->assertSame(1, $kode);
        $this->assertStringContainsString('Gagal: tidak ada berkas *.up.sql di "', $keluaran);
        $this->assertStringNotContainsString('SETUP_TOKEN', $keluaran);
        $this->assertStringNotContainsString('PORT', $keluaran);
    }

    public function test_an_unknown_subcommand_prints_the_usage(): void
    {
        [$kode, $keluaran] = $this->migrate(['perintah' => 'down']);

        $this->assertSame(1, $kode);
        $this->assertSame("Pemakaian: php artisan bengkel:migrate [--dir=folder] [up | versi | paksa N]\n"
            ."Gagal: perintah \"down\" tidak dikenal\n", $keluaran);
    }

    public function test_paksa_needs_a_valid_version_number(): void
    {
        [$kode, $keluaran] = $this->migrate(['perintah' => 'paksa']);
        $this->assertSame(1, $kode);
        $this->assertSame("Gagal: pemakaian: php artisan bengkel:migrate paksa NOMOR_VERSI\n", $keluaran);

        [$kode, $keluaran] = $this->migrate(['perintah' => 'force', 'nomor' => 'tujuh']);
        $this->assertSame(1, $kode);
        $this->assertSame("Gagal: nomor versi \"tujuh\" tidak sah\n", $keluaran);
    }
}
