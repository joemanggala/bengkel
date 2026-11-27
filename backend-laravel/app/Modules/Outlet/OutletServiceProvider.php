<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Outlet;

use App\Modules\Outlet\Contracts\OutletRepositoryInterface;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

final class OutletServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(OutletRepositoryInterface::class, OutletRepository::class);
    }

    public function boot(): void
    {
        Route::get('api/outlet', [OutletController::class, 'show']);
        Route::put('api/outlet', [OutletController::class, 'update'])->middleware(['json', 'staff', 'peran:owner']);
    }
}
