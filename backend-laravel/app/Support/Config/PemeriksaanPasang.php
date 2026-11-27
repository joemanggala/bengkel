<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Config;

use App\Support\Database\SqlError;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

/**
 * Pemeriksaan sebelum backend melayani permintaan: env sah, database bisa
 * dihubungi, dan skema dari db/migrations sudah terpasang.
 *
 * Di balik PHP-FPM, env baru dibaca saat permintaan pertama datang, jadi env
 * yang salah baru ketahuan sebagai 500. Pemeriksaan ini dijalankan saat
 * memasang (php artisan bengkel:periksa) dan setiap kali bengkel:serve
 * menyala, supaya kesalahan terlihat lebih awal dengan pesan yang jelas.
 */
final class PemeriksaanPasang
{
    /**
     * 16 tabel dari migration 000001_awal. Database yang belum dimigrasi
     * tidak lolos, supaya permintaan tidak gagal di tengah jalan karena
     * tabelnya belum ada.
     */
    public const TABLES = ['staff', 'staff_sessions', 'login_attempts', 'outlet', 'customers', 'vehicles',
        'services', 'parts', 'counters', 'work_orders', 'work_order_items', 'work_order_status_logs', 'payments',
        'stock_movements', 'bookings', 'wa_messages'];

    /** Baris penghitung yang ditulis migration; nomor SPK dan booking diambil dari sini. */
    public const COUNTERS = ['work_order_number', 'booking_number'];

    /**
     * @throws ConfigurationError env kosong atau tidak sah
     * @throws RuntimeException database tidak bisa dihubungi atau skema belum lengkap
     */
    public static function jalankan(): Settings
    {
        $settings = Settings::fromEnvironment();
        self::periksaDatabase();

        return $settings;
    }

    /**
     * Pesan galat driver (alamat server, nama pengguna) sengaja tidak ikut
     * dicetak: yang ditampilkan hanya nomor galat MySQL, cukup untuk dicari
     * di dokumentasi tanpa membocorkan isi DATABASE_URL ke terminal atau log.
     */
    private static function periksaDatabase(): void
    {
        try {
            $database = (string) DB::connection()->getDatabaseName();
            $ada = DB::table('information_schema.tables')->where('table_schema', $database)
                ->whereIn('table_name', self::TABLES)->count();
            $barisAwalAda = $ada === count(self::TABLES)
                && DB::table('outlet')->where('outlet_id', 1)->exists()
                && DB::table('counters')->whereIn('name', self::COUNTERS)->count() === count(self::COUNTERS);
        } catch (Throwable $e) {
            throw new RuntimeException(sprintf('database tidak bisa dihubungi atau ditolak (galat %s); periksa DATABASE_URL dan pastikan MySQL menyala',
                SqlError::errno($e) ?? 'tidak dikenal'));
        }
        if ($ada !== count(self::TABLES)) {
            throw new RuntimeException(sprintf('database %s baru punya %d dari %d tabel; jalankan migration db/migrations lebih dulu',
                $database, $ada, count(self::TABLES)));
        }
        if (! $barisAwalAda) {
            throw new RuntimeException('baris awal outlet atau counters tidak ada; jalankan ulang migration');
        }
    }
}
