<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

/**
 * Isian PATCH /api/work-orders/{number}. Field yang tidak dikirim tidak
 * berubah, sedangkan null pada mechanicId, odometer, dan estimatedDoneAt
 * berarti mengosongkannya; karena itu kunci yang dikirim dicatat terpisah
 * dari nilainya.
 */
final class PerubahanSpk
{
    /** @param  array<string, mixed>  $kolom  nama kolom work_orders → nilai baru, hanya field yang dikirim */
    public function __construct(public readonly array $kolom) {}

    public function kosong(): bool
    {
        return $this->kolom === [];
    }
}
