<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Staf;

use App\Modules\Sesi\Peran;

/** Isi PATCH /api/staff/{staffId}: null berarti field itu tidak dikirim (tidak berubah). */
final class PerubahanStaf
{
    public function __construct(
        public readonly ?string $name = null,
        public readonly ?string $email = null,
        public readonly ?string $password = null,
        public readonly ?Peran $role = null,
        public readonly ?bool $isActive = null,
    ) {}
}
