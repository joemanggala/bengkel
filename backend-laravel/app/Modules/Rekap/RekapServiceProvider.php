<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Rekap;

use App\Modules\Rekap\Contracts\RekapRepositoryInterface;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/** Rekap harian: /api/reports/daily. */
final class RekapServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(RekapRepositoryInterface::class, RekapRepository::class);
    }

    /** Tanpa badan, jadi tanpa json: staff (401) → peran pemilik (403) → 422 query di controller. */
    public function boot(): void
    {
        Route::get('api/reports/daily', [RekapController::class, 'daily'])->middleware(['staff', 'peran:owner']);
    }
}
