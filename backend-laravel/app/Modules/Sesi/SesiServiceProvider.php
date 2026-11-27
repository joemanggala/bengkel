<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sesi;

use App\Modules\Sesi\Contracts\SesiRepositoryInterface;
use Illuminate\Support\ServiceProvider;

/**
 * Modul Sesi tidak punya rute sendiri. Ia dipakai middleware staff untuk
 * memeriksa token, dan oleh modul Staf (setup dan masuk) untuk membuka serta
 * menutup sesi.
 */
final class SesiServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SesiRepositoryInterface::class, SesiRepository::class);
    }
}
