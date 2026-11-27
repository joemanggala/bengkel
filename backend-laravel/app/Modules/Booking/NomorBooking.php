<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking;

use InvalidArgumentException;

/**
 * Nomor booking: "B-" + nilai penghitung counters.booking_number, minimal
 * empat digit (B-0001, B-9999, B-10000). Berurutan terus, tidak direset per
 * hari, sama dengan nomor SPK.
 */
final class NomorBooking
{
    public static function dari(int $urutan): string
    {
        if ($urutan < 1) {
            throw new InvalidArgumentException('nomor booking dimulai dari 1');
        }

        return 'B-'.str_pad((string) $urutan, 4, '0', STR_PAD_LEFT);
    }
}
