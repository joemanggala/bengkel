<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Validation;

/**
 * Pola regex bersama, disalin dari spec.
 *
 * Dua hal yang wajib di PHP:
 *  - Pembatas "/" yang muncul di dalam pola di-escape menjadi "\/".
 *  - Modifier "D": tanpa itu "$" PCRE juga cocok sebelum baris baru di akhir
 *    teks, sehingga UUID yang diakhiri "\n" akan dianggap sah. Pola di spec
 *    berarti "akhir teks", sama dengan regexp Go dan JavaScript.
 */
final class Patterns
{
    /** UUID kanonik huruf kecil. */
    public const UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D';

    public static function matches(string $pattern, string $value): bool
    {
        return preg_match($pattern, $value) === 1;
    }
}
