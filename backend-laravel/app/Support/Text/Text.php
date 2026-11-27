<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Text;

/**
 * Olahan teks kecil yang aturannya ditetapkan kontrak.
 *
 * Fungsi bawaan PHP seperti trim() dan strtolower() memakai definisi yang
 * berbeda (trim() juga membuang NUL dan tab vertikal, strtolower() bisa
 * terpengaruh locale). Kontrak sengaja memakai aturan ASCII yang sempit
 * supaya PHP, Go, dan Node menghasilkan teks yang sama persis.
 */
final class Text
{
    /** "Dipangkas" menurut kontrak: spasi, tab, CR, dan LF. */
    private const TRIM_SET = " \t\r\n";

    public static function trim(string $text): string
    {
        return trim($text, self::TRIM_SET);
    }

    /** Hanya A-Z menjadi a-z; huruf lain (termasuk É) tidak disentuh. */
    public static function lowerAscii(string $text): string
    {
        return strtr($text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz');
    }

    /** Hanya a-z menjadi A-Z (nomor SPK/booking di pencarian, plat). */
    public static function upperAscii(string $text): string
    {
        return strtr($text, 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }

    public static function isAscii(string $text): bool
    {
        return preg_match('/[\x80-\xff]/', $text) !== 1;
    }

    /** Panjang dalam code point Unicode, bukan byte: "é" = 1. */
    public static function length(string $text): int
    {
        return mb_strlen($text, 'UTF-8');
    }
}
