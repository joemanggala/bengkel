<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Providers;

use App\Support\Config\Settings;
use App\Support\Time\Clock;
use Illuminate\Support\ServiceProvider;

/**
 * Merakit utilitas bersama (app/Support) yang dipakai banyak modul. Semuanya
 * singleton: dibuat sekali per permintaan, saat pertama kali dibutuhkan.
 */
final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(Settings::class, fn () => Settings::fromEnvironment());
        $this->app->singleton(Clock::class);
    }
}
