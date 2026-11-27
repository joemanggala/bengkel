<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Console\Commands;

use App\Support\Config\ConfigurationError;
use App\Support\Config\PemeriksaanPasang;
use App\Support\Http\LogAkses;
use Illuminate\Console\Command;
use Throwable;

/**
 * Menyalakan backend dengan server HTTP bawaan PHP (php -S).
 *
 * `php artisan serve` bawaan Laravel tidak dipakai karena:
 *  - ia membaca port dari --port/SERVER_PORT, bukan env PORT yang dipakai
 *    bersama ketiga backend;
 *  - selama ada berkas .env, ia membuang env dari shell sebelum menyalakan
 *    proses server, padahal tes kontrak memberi env lewat baris perintah;
 *  - ia tidak memeriksa env dan database lebih dulu, jadi salah konfigurasi
 *    baru ketahuan saat permintaan pertama gagal;
 *  - router-nya melayani berkas statis dari public/.
 *
 * Perintah ini menjalankan pemeriksaan yang sama dengan bengkel:periksa (env,
 * koneksi database, dan skema; gagal = tidak menyala, dengan
 * pesan yang menyebut nama env-nya), lalu menjalankan php -S dengan
 * pengaturan:
 *  - enable_post_data_reading=0: badan selalu bisa dibaca mentah dari
 *    php://input apa pun Content-Type-nya. Tanpa ini, badan ber-Content-Type
 *    multipart/form-data dihabiskan PHP sebelum Laravel sempat membacanya;
 *  - expose_php=0: tanpa header X-Powered-By;
 *  - display_errors=0, log_errors=1, error_log=php://stderr: peringatan PHP
 *    tidak boleh tercampur ke badan JSON. Peringatan awal permintaan, mis.
 *    "Input variables exceeded 1000" untuk lebih dari 1.000 parameter query
 *    atau cookie, ditulis PHP SEBELUM kode aplikasi jalan, jadi tidak bisa
 *    dimatikan lewat ini_set di dalam Laravel; ia harus dimatikan di
 *    pengaturan PHP. Peringatannya tetap tercatat di log (stderr);
 *  - OPcache untuk CLI, supaya Laravel tidak dikompilasi ulang setiap
 *    permintaan.
 *
 * Server bawaan PHP melayani satu permintaan sekaligus. Itu cukup untuk dev
 * dan tes kontrak; untuk produksi pakai Nginx + PHP-FPM (lihat README).
 */
final class ServeCommand extends Command
{
    /**
     * Pengaturan PHP yang selalu dipasang, apa pun isi php.ini mesinnya
     * (opsi -d menimpa php.ini).
     */
    public const INI_WAJIB = [
        'enable_post_data_reading=0',
        'expose_php=0',
        'display_errors=0',
        'log_errors=1',
        'error_log=php://stderr',
    ];

    protected $signature = 'bengkel:serve {--host=127.0.0.1 : Alamat yang didengarkan; port dari env PORT}';

    protected $description = 'Menyalakan backend bengkel dengan server HTTP bawaan PHP';

    public function handle(): int
    {
        try {
            $settings = PemeriksaanPasang::jalankan();
        } catch (ConfigurationError $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        } catch (Throwable $e) {
            $this->error('backend gagal menyala: '.$e->getMessage());

            return self::FAILURE;
        }

        $host = (string) $this->option('host');
        $address = (str_contains($host, ':') ? '['.$host.']' : $host).':'.$settings->port;
        $command = [PHP_BINARY, ...$this->iniOptions(), '-S', $address, '-t', $this->laravel->publicPath(), $this->laravel->basePath('server.php')];

        $this->info(sprintf('backend bengkel siap di http://%s (pemasangan pemilik %s)',
            $address, $settings->setupToken === '' ? 'dimatikan' : 'aktif'));

        return $this->runServer($command);
    }

    /**
     * Opsi `-d` untuk php -S. Publik supaya bisa diuji tanpa menyalakan server.
     *
     * @return list<string>
     */
    public function iniOptions(): array
    {
        $options = [];
        foreach (self::INI_WAJIB as $setting) {
            $options = [...$options, '-d', $setting];
        }
        if (! extension_loaded('Zend OPcache') && $this->opcacheAvailable()) {
            $options = [...$options, '-d', 'zend_extension=opcache'];
        }

        return [...$options, '-d', 'opcache.enable_cli=1'];
    }

    private function opcacheAvailable(): bool
    {
        $dir = (string) ini_get('extension_dir');

        return is_file($dir.'/php_opcache.dll') || is_file($dir.'/opcache.so');
    }

    /**
     * Menjalankan server dan meneruskan lognya. Baris "Accepted"/"Closing"
     * untuk setiap koneksi dibuang supaya log aplikasi terbaca, dan baris
     * akses dibersihkan dari query string serta token di path (LogAkses).
     *
     * @param  list<string>  $command
     */
    private function runServer(array $command): int
    {
        $process = proc_open($command, [0 => STDIN, 1 => STDOUT, 2 => ['pipe', 'w']], $pipes, $this->laravel->basePath());
        if (! is_resource($process)) {
            $this->error('server PHP tidak bisa dijalankan');

            return self::FAILURE;
        }
        while (($line = fgets($pipes[2])) !== false) {
            if (preg_match('/^\[[^\]]+\] \S+ (Accepted|Closing)$/', rtrim($line)) === 1) {
                continue;
            }
            fwrite(STDERR, LogAkses::bersihkan($line));
        }
        fclose($pipes[2]);

        return proc_close($process) === 0 ? self::SUCCESS : self::FAILURE;
    }
}
