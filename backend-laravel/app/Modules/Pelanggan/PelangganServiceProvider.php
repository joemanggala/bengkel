<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Pelanggan;

use App\Modules\Pelanggan\Contracts\PelangganRepositoryInterface;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/** Pelanggan dan kendaraan: /api/customers…, /api/vehicles, /api/vehicles/{vehicleId}. */
final class PelangganServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PelangganRepositoryInterface::class, PelangganRepository::class);
    }

    /**
     * Urutan alias middleware = urutan pemeriksaan kontrak: json (413/400) →
     * staff (401) → peran (403). Mekanik tidak boleh membuka data pelanggan.
     * Rute tanpa badan (GET) tidak memakai json, jadi badannya diabaikan.
     * GET /api/vehicles/{vehicleId}/work-orders didaftarkan modul Servis.
     */
    public function boot(): void
    {
        $staf = ['staff', 'peran:owner,cashier'];
        $stafBerbadan = ['json', ...$staf];

        Route::get('api/customers', [PelangganController::class, 'index'])->middleware($staf);
        Route::post('api/customers', [PelangganController::class, 'store'])->middleware($stafBerbadan);
        Route::get('api/customers/{customerId}', [PelangganController::class, 'show'])->middleware($staf);
        Route::patch('api/customers/{customerId}', [PelangganController::class, 'update'])->middleware($stafBerbadan);
        Route::post('api/customers/{customerId}/vehicles', [KendaraanController::class, 'store'])->middleware($stafBerbadan);

        Route::get('api/vehicles', [KendaraanController::class, 'index'])->middleware($staf);
        Route::patch('api/vehicles/{vehicleId}', [KendaraanController::class, 'update'])->middleware($stafBerbadan);
    }
}
