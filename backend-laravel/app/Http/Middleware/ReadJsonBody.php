<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\Http\ApiError;
use App\Support\Http\RawBody;
use App\Support\Validation\JsonObject;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Membaca badan sebagai objek JSON sebelum sesi diperiksa, sesuai urutan
 * kontrak: 413 payload_too_large (lebih dari 1 MiB) → 400 bad_request (bukan
 * objek JSON) → 401. Jadi JSON rusak tanpa token dibalas 400, bukan 401.
 *
 * Content-Type tidak diperiksa: badan selalu dibaca mentah, sama seperti
 * backend Go dan NestJS. Hasilnya dititipkan di atribut request; controller
 * mengambilnya lewat JsonObject::ATTRIBUTE.
 */
final class ReadJsonBody
{
    /** Batas badan JSON: 1 MiB. */
    public const MAX_BYTES = 1024 * 1024;

    public function handle(Request $request, Closure $next): Response
    {
        $body = RawBody::read($request, self::MAX_BYTES);
        if ($body === null) {
            throw ApiError::payloadTooLarge();
        }
        $request->attributes->set(JsonObject::ATTRIBUTE, JsonObject::parse($body));

        return $next($request);
    }
}
