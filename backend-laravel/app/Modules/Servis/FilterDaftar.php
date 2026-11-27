<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Support\Database\SearchTerm;

/**
 * Saringan daftar SPK (papan servis) dan riwayat servis kendaraan. Semua
 * saringan digabung dengan AND; null berarti tidak menyaring.
 */
final class FilterDaftar
{
    /**
     * @param  list<string>|null  $lingkup  status dari ?scope= (active/history)
     * @param  array{0: string, 1: string}|null  $rentang  [mulai, akhir) UTC untuk ?date=, nilai DATETIME(3)
     */
    public function __construct(
        public readonly ?string $status = null,
        public readonly ?array $lingkup = null,
        public readonly ?string $mechanicId = null,
        public readonly ?array $rentang = null,
        public readonly ?SearchTerm $search = null,
        public readonly bool $terlama = false,
        public readonly ?string $vehicleId = null,
    ) {}
}
