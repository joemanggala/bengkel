<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Console\Commands;

use App\Support\Config\ConfigurationError;
use App\Support\Config\PemeriksaanPasang;
use Illuminate\Console\Command;
use Throwable;

/**
 * Memeriksa env, koneksi database, dan skema tanpa menyalakan server.
 *
 * Wajib dijalankan saat memasang di balik Nginx + PHP-FPM, dengan env yang
 * sama dengan pool FPM: di sana tidak ada perintah serve yang memeriksa env
 * lebih dulu, jadi env yang salah baru ketahuan saat permintaan pertama
 * gagal 500.
 */
final class PeriksaCommand extends Command
{
    protected $signature = 'bengkel:periksa';

    protected $description = 'Memeriksa env, koneksi database, dan skema backend bengkel';

    public function handle(): int
    {
        try {
            $settings = PemeriksaanPasang::jalankan();
        } catch (ConfigurationError $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        } catch (Throwable $e) {
            $this->error('pemeriksaan gagal: '.$e->getMessage());

            return self::FAILURE;
        }
        $this->info('env, database, dan skema siap');
        $this->line('pemasangan pemilik pertama (SETUP_TOKEN): '.($settings->setupToken === ''
            ? 'mati'
            : 'AKTIF; kosongkan lagi setelah akun pemilik dibuat'));

        return self::SUCCESS;
    }
}
