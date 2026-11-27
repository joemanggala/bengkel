<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Database;

/**
 * Term pencarian untuk `kolom LIKE CONCAT('%', ?, '%')`.
 *
 * Kasir yang mengetik "50%" atau "a_b" mencari teks itu apa adanya, bukan
 * pola. Karakter escape-nya "\" bawaan MySQL, jadi "\" sendiri digandakan
 * lebih dulu (kalau tidak, "\" di akhir term akan meng-escape "%" penutup),
 * baru "%" dan "_". Term selalu dikirim sebagai parameter terikat, tidak
 * pernah disambung ke SQL.
 */
final class Like
{
    /** Potongan SQL pencocok "mengandung term"; pasangkan dengan escape() sebagai parameter. */
    public const CONTAINS = "LIKE CONCAT('%', ?, '%')";

    public static function escape(string $term): string
    {
        return strtr($term, ['\\' => '\\\\', '%' => '\\%', '_' => '\\_']);
    }
}
