<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Outlet\Contracts;

use App\Modules\Outlet\ProfilOutlet;

/** Akses tabel outlet (tepat satu baris, outlet_id = 1). */
interface OutletRepositoryInterface
{
    public function ambil(): ProfilOutlet;

    public function simpan(ProfilOutlet $profil, string $now): void;
}
