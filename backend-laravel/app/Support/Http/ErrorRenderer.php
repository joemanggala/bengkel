<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Http;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Mengubah galat yang bukan ApiError menjadi balasan kontrak.
 *
 * Router Laravel membalas 404 untuk path tak dikenal dan 405 untuk metode
 * yang salah; kontrak menuntut keduanya 404 not_found. Galat lain dianggap
 * kegagalan tak terduga: klien hanya menerima pesan umum, dan penyebabnya
 * sudah dicatat oleh penangan galat Laravel.
 */
final class ErrorRenderer
{
    public static function render(Throwable $e): Response
    {
        if ($e instanceof ApiError) {
            return $e->render();
        }
        if ($e instanceof HttpExceptionInterface && in_array($e->getStatusCode(), [404, 405], true)) {
            return ApiError::notFound('Rute tidak ditemukan')->render();
        }

        return ApiError::internal($e)->render();
    }
}
