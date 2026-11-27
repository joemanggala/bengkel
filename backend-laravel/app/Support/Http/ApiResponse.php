<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/**
 * Balasan sukses berbentuk kontrak: {"data": ...}; daftar menambahkan
 * "meta": {"page", "limit", "total"}.
 */
final class ApiResponse
{
    /**
     * Garis miring dan huruf non-ASCII ditulis apa adanya supaya balasan mudah
     * dibaca; keduanya tetap JSON yang sah.
     */
    private const FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE;

    /** @param  array<string, string>  $headers */
    public static function json(mixed $payload, int $status = 200, array $headers = []): JsonResponse
    {
        return new JsonResponse($payload, $status, $headers, self::FLAGS);
    }

    public static function data(mixed $data, int $status = 200): JsonResponse
    {
        return self::json(['data' => $data], $status);
    }

    /** @param  list<mixed>  $items */
    public static function list(array $items, Page $page, int $total): JsonResponse
    {
        return self::json(['data' => $items, 'meta' => $page->meta($total)]);
    }

    /** 204 tanpa badan dan tanpa Content-Type. */
    public static function noContent(): Response
    {
        return new Response('', 204);
    }
}
