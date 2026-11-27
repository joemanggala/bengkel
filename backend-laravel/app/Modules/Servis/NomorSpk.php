<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use InvalidArgumentException;

/**
 * Nomor SPK: "S-" + nilai penghitung counters.work_order_number, minimal
 * empat digit (S-0001, S-9999, S-10000). Berurutan terus untuk outlet dan
 * tidak direset per hari, supaya satu nomor selalu menunjuk satu SPK.
 */
final class NomorSpk
{
    private const POLA = '/^S-[0-9]{4,}$/D';

    public static function dari(int $urutan): string
    {
        if ($urutan < 1) {
            throw new InvalidArgumentException('nomor SPK dimulai dari 1');
        }

        return 'S-'.str_pad((string) $urutan, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Nomor di path dicocokkan persis: "s-0001", "S-1", atau "S-0001\n" tidak
     * sah dan langsung dijawab 404 tanpa bertanya ke database.
     */
    public static function sah(string $nomor): bool
    {
        return preg_match(self::POLA, $nomor) === 1;
    }
}
