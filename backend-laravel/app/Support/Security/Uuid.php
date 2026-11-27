<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Security;

use App\Support\Validation\Patterns;

/**
 * UUID versi 4 huruf kecil.
 *
 * ID dibuat aplikasi, bukan database: MySQL tidak punya RETURNING, jadi
 * aplikasi perlu tahu ID baris baru sebelum INSERT supaya bisa langsung
 * memakainya tanpa membaca ulang.
 */
final class Uuid
{
    public static function new(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40); // versi 4
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80); // varian RFC 9562
        $hex = bin2hex($bytes);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'
            .substr($hex, 16, 4).'-'.substr($hex, 20);
    }

    /**
     * Huruf besar sengaja ditolak: kolom ID memakai collation biner, jadi
     * "ABC..." memang bukan ID yang sama dengan "abc...". ID seperti itu
     * tidak mungkin ada, sehingga pemanggil cukup menjawab 404 tanpa bertanya
     * ke database.
     */
    public static function valid(string $value): bool
    {
        return Patterns::matches(Patterns::UUID, $value);
    }
}
