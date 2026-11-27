<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Support\Http\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Halaman lacak servis pelanggan (/servis/{trackingToken}), yang juga
 * menjadi nota online. Publik: pelanggan tidak punya akun, jadi token lacak
 * adalah satu-satunya kunci, dan header Authorization diabaikan.
 */
final class LacakController
{
    public function __construct(private readonly ServisService $servis) {}

    /** GET /api/public/work-orders/{trackingToken}: 404 → 200 (SpkPublik). */
    public function show(string $trackingToken): JsonResponse
    {
        return ApiResponse::data($this->servis->publik($trackingToken));
    }
}
