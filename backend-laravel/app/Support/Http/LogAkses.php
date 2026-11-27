<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Http;

/**
 * Membersihkan baris log akses server bawaan PHP sebelum diteruskan ke log.
 *
 * `php -S` menulis satu baris per permintaan, mis.
 * "[Fri Nov 27 03:30:01 2026] 127.0.0.1:50321 [200]: GET /api/customers?search=0812".
 * Dua bagiannya bisa berisi rahasia:
 *  - query string (pencarian bisa memuat nomor HP atau plat pelanggan);
 *  - token di path rute publik: bookingToken dan trackingToken (43 karakter
 *    base64url) adalah "kunci" ke satu booking atau satu SPK.
 *
 * Yang tersisa hanya metode, pola rute, dan status, sama dengan log backend
 * Go: cukup untuk menelusuri masalah tanpa menyimpan data pengguna.
 */
final class LogAkses
{
    private const BARIS_AKSES = '/^(\[[^\]]*\] \S+ \[\d{3}\]: [A-Z]+ )(\S+)(.*)$/Ds';

    public static function bersihkan(string $baris): string
    {
        if (preg_match(self::BARIS_AKSES, $baris, $m) !== 1) {
            return $baris;
        }
        $path = explode('?', $m[2], 2)[0];
        $path = preg_replace('~/api/public/(bookings|work-orders)/[A-Za-z0-9_-]{43}(?=/|$)~', '/api/public/$1/{token}', $path) ?? $path;

        return $m[1].$path.$m[3];
    }
}
