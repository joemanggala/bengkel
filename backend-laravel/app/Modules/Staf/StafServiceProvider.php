<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Staf;

use App\Modules\Staf\Contracts\StafRepositoryInterface;
use App\Support\Security\BatasMasuk;
use App\Support\Security\BatasMasukDatabase;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

final class StafServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(StafRepositoryInterface::class, StafRepository::class);
        // Hitungan percobaan masuk di tabel login_attempts: proses PHP-FPM tidak berbagi memori.
        $this->app->bind(BatasMasuk::class, BatasMasukDatabase::class);
    }

    /**
     * Urutan alias middleware = urutan pemeriksaan kontrak: json (413/400) →
     * staff (401) → peran (403). Setup dan masuk publik. Rute tanpa badan
     * (logout, me, daftar) tidak memakai json, jadi badannya diabaikan.
     */
    public function boot(): void
    {
        Route::get('api/setup', [SetupController::class, 'status']);
        Route::post('api/setup', [SetupController::class, 'pasang'])->middleware('json');
        Route::post('api/staff/login', [StafController::class, 'login'])->middleware('json');
        Route::post('api/staff/logout', [StafController::class, 'logout'])->middleware('staff');
        Route::get('api/staff/me', [StafController::class, 'me'])->middleware('staff');

        Route::get('api/staff', [KelolaStafController::class, 'index'])->middleware(['staff', 'peran:owner']);
        Route::post('api/staff', [KelolaStafController::class, 'store'])->middleware(['json', 'staff', 'peran:owner']);
        Route::patch('api/staff/{staffId}', [KelolaStafController::class, 'update'])->middleware(['json', 'staff', 'peran:owner']);
        Route::get('api/mechanics', [KelolaStafController::class, 'mechanics'])->middleware(['staff', 'peran:owner,cashier']);
    }
}
