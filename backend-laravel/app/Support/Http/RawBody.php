<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Http;

use Illuminate\Http\Request;

/** Membaca badan mentah permintaan dengan batas ukuran. */
final class RawBody
{
    /**
     * Badan apa adanya, atau null bila lebih dari $maxBytes. Content-Length
     * yang sudah jujur menyebut ukuran berlebih ditolak tanpa membaca badan;
     * badan tanpa Content-Length (chunked) dibaca paling banyak $maxBytes + 1,
     * jadi klien tidak bisa memaksa server menampung badan raksasa.
     */
    public static function read(Request $request, int $maxBytes): ?string
    {
        $declared = self::contentLength($request);
        if ($declared !== null && $declared > $maxBytes) {
            return null;
        }
        $stream = $request->getContent(true);
        $body = '';
        while (! feof($stream) && strlen($body) <= $maxBytes) {
            $chunk = fread($stream, min(64 * 1024, $maxBytes + 1 - strlen($body)));
            if ($chunk === false || $chunk === '') {
                break;
            }
            $body .= $chunk;
        }

        return strlen($body) > $maxBytes ? null : $body;
    }

    /** Nilai header Content-Length; null bila tidak ada atau bukan angka. */
    public static function contentLength(Request $request): ?int
    {
        $value = $request->server('CONTENT_LENGTH', $request->server('HTTP_CONTENT_LENGTH'));
        if (! is_string($value) || trim($value) === '' || ! ctype_digit(trim($value))) {
            return null;
        }
        $digits = ltrim(trim($value), '0');

        // Angka sepanjang apa pun tetap terbaca "sangat besar" tanpa meluap.
        return $digits === '' ? 0 : (strlen($digits) > 18 ? PHP_INT_MAX : (int) $digits);
    }
}
