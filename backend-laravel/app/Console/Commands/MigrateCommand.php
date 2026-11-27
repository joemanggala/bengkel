<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Console\Commands;

use App\Support\Config\Settings;
use App\Support\Migrasi\Berkas;
use App\Support\Migrasi\Migrasi;
use App\Support\Migrasi\MigrasiKotor;
use App\Support\Migrasi\Pelaksana;
use Illuminate\Console\Command;
use RuntimeException;
use Symfony\Component\Console\Formatter\OutputFormatter;
use Throwable;

/**
 * Membuat dan memperbarui tabel database tanpa Docker. Jalankan dari folder
 * backend-laravel; DATABASE_URL dibaca dari .env atau shell, sama dengan
 * backend:
 *
 *   php artisan bengkel:migrate            jalankan semua migrasi yang belum (sama dengan "up")
 *   php artisan bengkel:migrate up
 *   php artisan bengkel:migrate versi      tampilkan versi database
 *   php artisan bengkel:migrate paksa 7    tetapkan versi setelah memperbaiki migrasi yang gagal
 *
 * Berkas migrasi dibaca dari ../db/migrations (ubah lewat --dir). Catatan
 * versinya sama dengan "docker compose run --rm migrate-dev up", jadi kedua
 * cara boleh dipakai bergantian di database yang sama.
 *
 * Perintah ini hanya membutuhkan DATABASE_URL. Env lain (PORT, WA_*,
 * SETUP_TOKEN) tidak diperiksa, supaya tabel bisa dibuat sebelum semua
 * pengaturan backend selesai diisi.
 */
final class MigrateCommand extends Command
{
    private const PEMAKAIAN = 'Pemakaian: php artisan bengkel:migrate [--dir=folder] [up | versi | paksa N]';

    protected $signature = 'bengkel:migrate
        {perintah=up : up (jalankan yang belum), versi, atau paksa}
        {nomor? : nomor versi untuk paksa}
        {--dir= : folder berkas migrasi (bawaan: ../db/migrations dari folder backend-laravel)}';

    protected $description = 'Menjalankan migrasi db/migrations tanpa Docker (up, versi, paksa N)';

    public function handle(): int
    {
        try {
            $this->jalankan();
        } catch (Throwable $e) {
            $this->getOutput()->getErrorStyle()->writeln('<error>'.OutputFormatter::escape('Gagal: '.$e->getMessage()).'</error>');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    private function jalankan(): void
    {
        $perintah = match ((string) $this->argument('perintah')) {
            'up' => 'up',
            'versi', 'version' => 'versi',
            'paksa', 'force' => 'paksa',
            default => null,
        };
        if ($perintah === null) {
            $this->getOutput()->getErrorStyle()->writeln(OutputFormatter::escape(self::PEMAKAIAN));
            throw new RuntimeException(sprintf('perintah "%s" tidak dikenal', (string) $this->argument('perintah')));
        }
        $versiPaksa = null;
        if ($perintah === 'paksa') {
            $nomor = $this->argument('nomor');
            if ($nomor === null) {
                throw new RuntimeException('pemakaian: php artisan bengkel:migrate paksa NOMOR_VERSI');
            }
            $versiPaksa = Migrasi::bacaVersi((string) $nomor);
            if ($versiPaksa === null) {
                throw new RuntimeException(sprintf('nomor versi "%s" tidak sah', (string) $nomor));
            }
        }

        $databaseUrl = Settings::databaseUrlFromEnvironment();
        if ($databaseUrl === '') {
            throw new RuntimeException('DATABASE_URL kosong; salin .env.example menjadi .env di folder backend-laravel, lalu jalankan lagi dari folder itu');
        }

        $daftar = Migrasi::muat($this->folder());
        $pelaksana = new Pelaksana(Migrasi::buka($databaseUrl));
        $terakhir = $daftar[count($daftar) - 1]->versi;

        if ($perintah === 'up') {
            $n = $pelaksana->naik($daftar, function (Berkas $b): void {
                $this->line(OutputFormatter::escape('Menjalankan '.$b->nama));
            });
            $this->line($n === 0
                ? sprintf('Database sudah terbaru (versi %d). Tidak ada yang dijalankan.', $terakhir)
                : sprintf('Selesai: %d migrasi dijalankan, database kini di versi %d.', $n, $terakhir));

            return;
        }

        if ($perintah === 'versi') {
            $st = $pelaksana->status();
            if ($st->kotor) {
                throw new MigrasiKotor($st->versi);
            }
            $this->line(match (true) {
                ! $st->ada => sprintf('Database masih kosong (belum ada migrasi). Berkas terbaru: versi %d.', $terakhir),
                $st->versi < $terakhir => sprintf('Database di versi %d; ada migrasi baru sampai versi %d. Jalankan: php artisan bengkel:migrate up', $st->versi, $terakhir),
                default => sprintf('Database di versi %d (terbaru).', $st->versi),
            });

            return;
        }

        $pelaksana->paksa($daftar, (int) $versiPaksa);
        $this->line(sprintf('Versi database ditetapkan ke %d tanpa menjalankan berkas apa pun.', (int) $versiPaksa));
    }

    /**
     * Folder bawaan dihitung dari folder backend-laravel, jadi tetap benar
     * walau artisan dipanggil dari folder lain. --dir yang relatif dihitung
     * dari folder kerja, seperti path lain yang diketik di terminal.
     */
    private function folder(): string
    {
        $dir = (string) $this->option('dir');
        if ($dir === '') {
            $dir = $this->laravel->basePath('..'.DIRECTORY_SEPARATOR.'db'.DIRECTORY_SEPARATOR.'migrations');
        }

        return realpath($dir) ?: $dir;
    }
}
