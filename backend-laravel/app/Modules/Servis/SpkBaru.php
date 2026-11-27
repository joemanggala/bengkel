<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

/**
 * Isian SPK baru yang sudah lolos validasi: dari kasir (POST
 * /api/work-orders) atau dari booking yang dijadikan SPK. Pelanggan selalu
 * pemilik kendaraan, jadi keduanya dibawa bersama.
 */
final class SpkBaru
{
    /** @param  string|null  $estimatedDoneAt  DATETIME(3) UTC */
    public function __construct(
        public readonly string $vehicleId,
        public readonly string $customerId,
        public readonly string $complaint,
        public readonly ?int $odometer,
        public readonly ?string $estimatedDoneAt,
        public readonly ?string $mechanicId,
    ) {}
}
