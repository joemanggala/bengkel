<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sparepart;

use App\Modules\Sparepart\Contracts\SparepartRepositoryInterface;
use App\Modules\Stok\Contracts\StokRepositoryInterface;
use App\Modules\Stok\StokController;
use App\Modules\Stok\StokRepository;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/**
 * Sparepart dan kartu stok: /api/parts…, …/movements, …/stock-in, …/stock-out,
 * …/stock-count. Modul Stok tidak punya provider sendiri karena semua rutenya
 * berada di bawah /api/parts/{partId}, jadi didaftarkan di sini.
 */
final class SparepartServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SparepartRepositoryInterface::class, SparepartRepository::class);
        $this->app->bind(StokRepositoryInterface::class, StokRepository::class);
    }

    /**
     * Urutan alias middleware = urutan pemeriksaan kontrak: json (413/400) →
     * staff (401) → peran (403). Rute tanpa badan (daftar dan kartu stok)
     * tidak memakai json, jadi badannya diabaikan sepenuhnya.
     */
    public function boot(): void
    {
        $pemilikBerbadan = ['json', 'staff', 'peran:owner'];

        Route::get('api/parts', [SparepartController::class, 'index'])->middleware('staff');
        Route::post('api/parts', [SparepartController::class, 'store'])->middleware($pemilikBerbadan);
        Route::patch('api/parts/{partId}', [SparepartController::class, 'update'])->middleware($pemilikBerbadan);

        Route::get('api/parts/{partId}/movements', [StokController::class, 'kartu'])->middleware(['staff', 'peran:owner']);
        Route::post('api/parts/{partId}/stock-in', [StokController::class, 'masuk'])->middleware($pemilikBerbadan);
        Route::post('api/parts/{partId}/stock-out', [StokController::class, 'keluar'])->middleware($pemilikBerbadan);
        Route::post('api/parts/{partId}/stock-count', [StokController::class, 'hitung'])->middleware($pemilikBerbadan);
    }
}
