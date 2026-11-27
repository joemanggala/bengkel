<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Kesehatan;

use App\Support\Http\ApiResponse;
use Illuminate\Http\JsonResponse;

final class KesehatanController
{
    /**
     * GET /api/health: tidak menyentuh database. Tugasnya hanya menandai
     * proses siap menerima permintaan (dipakai harness tes untuk menunggu
     * backend), jadi bentuknya {"status": "ok"} tanpa pembungkus "data".
     */
    public function cek(): JsonResponse
    {
        return ApiResponse::json(['status' => 'ok']);
    }
}
