<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Jasa;

use App\Modules\Jasa\Contracts\JasaRepositoryInterface;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/** Katalog jasa: /api/services… dan /api/public/services. */
final class JasaServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(JasaRepositoryInterface::class, JasaRepository::class);
    }

    /**
     * Urutan alias middleware = urutan pemeriksaan kontrak: json (413/400) →
     * staff (401) → peran (403). Daftar staf tidak memakai json (badannya
     * diabaikan), dan daftar publik tidak memakai staff (Authorization
     * diabaikan sepenuhnya).
     */
    public function boot(): void
    {
        Route::get('api/public/services', [JasaController::class, 'publik']);
        Route::get('api/services', [JasaController::class, 'index'])->middleware('staff');
        Route::post('api/services', [JasaController::class, 'store'])->middleware(['json', 'staff', 'peran:owner']);
        Route::patch('api/services/{serviceId}', [JasaController::class, 'update'])->middleware(['json', 'staff', 'peran:owner']);
    }
}
