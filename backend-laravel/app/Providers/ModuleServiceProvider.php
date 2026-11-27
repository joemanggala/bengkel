<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Providers;

use App\Modules\Booking\BookingServiceProvider;
use App\Modules\Jasa\JasaServiceProvider;
use App\Modules\Kesehatan\KesehatanServiceProvider;
use App\Modules\Outlet\OutletServiceProvider;
use App\Modules\Pelanggan\PelangganServiceProvider;
use App\Modules\Rekap\RekapServiceProvider;
use App\Modules\Servis\ServisServiceProvider;
use App\Modules\Sesi\SesiServiceProvider;
use App\Modules\Sparepart\SparepartServiceProvider;
use App\Modules\Staf\StafServiceProvider;
use Illuminate\Support\ServiceProvider;

/**
 * Mendaftarkan semua modul. Setiap modul di app/Modules yang punya rute atau
 * repository memiliki ServiceProvider sendiri yang mengikat repository ke
 * kontraknya dan mendaftarkan rutenya, mengikuti pola Controller → Service →
 * Repository. Modul tanpa rute (WhatsApp, Stok) tidak perlu provider: kelasnya
 * dirakit otomatis oleh kontainer Laravel.
 *
 * Modul baru cukup ditambahkan ke daftar ini. Router Laravel memakai rute
 * pertama yang cocok untuk metode yang sama, jadi bila satu modul punya rute
 * tetap dan rute berparameter dengan metode yang sama (mis. GET
 * /api/staff/me dan GET /api/staff/{staffId}), daftarkan yang tetap lebih
 * dulu. Kontrak mewajibkan segmen tetap didahulukan.
 */
final class ModuleServiceProvider extends ServiceProvider
{
    private const MODULES = [
        KesehatanServiceProvider::class,
        SesiServiceProvider::class,
        StafServiceProvider::class,
        OutletServiceProvider::class,
        PelangganServiceProvider::class,
        JasaServiceProvider::class,
        SparepartServiceProvider::class,
        BookingServiceProvider::class,
        ServisServiceProvider::class,
        RekapServiceProvider::class,
    ];

    public function register(): void
    {
        foreach (self::MODULES as $module) {
            $this->app->register($module);
        }
    }
}
