<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\Http\ApiError;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Penjaga pintu sebelum router Laravel berjalan.
 *
 * Tiga perilaku bawaan Laravel bertentangan dengan kontrak (dan dengan
 * backend Go yang memakai net/http):
 *  1. Rute GET otomatis juga menjawab HEAD, dan OPTIONS dijawab otomatis 200
 *     dengan header Allow. Kontrak menuntut metode yang tidak tertulis
 *     dijawab 404.
 *  2. Garis miring di akhir diabaikan (/api/health/ = /api/health) dan "//"
 *     dirapikan; tidak ada rute kontrak yang berbentuk seperti itu.
 *  3. Path yang diawali nama skrip (/index.php/api/health) dianggap base URL
 *     dan dibuang, sehingga rute tetap cocok. Kontrak hanya mengenal /api/…,
 *     jadi base URL apa pun selain kosong berarti 404.
 *
 * Metode lain yang tidak punya rute ditolak router sendiri (405), lalu
 * ErrorRenderer mengubahnya menjadi 404.
 */
final class EnforceRouteShape
{
    private const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->getMethod(), self::METHODS, true) || $request->getBaseUrl() !== ''
            || ! self::isCleanPath($request->getPathInfo())) {
            // Laravel membuang badan balasan HEAD dengan sendirinya.
            throw ApiError::notFound('Rute tidak ditemukan');
        }

        return $next($request);
    }

    /** Path mentah tanpa segmen kosong, ".", "..", atau garis miring di akhir. */
    private static function isCleanPath(string $path): bool
    {
        if ($path === '/') {
            return true;
        }
        if ($path === '' || $path[0] !== '/') {
            return false;
        }
        foreach (explode('/', substr($path, 1)) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return false;
            }
        }

        return true;
    }
}
