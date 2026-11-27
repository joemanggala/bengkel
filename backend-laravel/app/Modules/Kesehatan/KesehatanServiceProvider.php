<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Kesehatan;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

final class KesehatanServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Route::get('api/health', [KesehatanController::class, 'cek']);
    }
}
