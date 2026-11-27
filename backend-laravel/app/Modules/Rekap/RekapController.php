<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Rekap;

use App\Support\Http\ApiError;
use App\Support\Http\ApiResponse;
use App\Support\Http\QueryParams;
use App\Support\Time\Wib;
use App\Support\Validation\FieldCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Rekap harian beserta laba kotor; khusus pemilik karena memuat modal. */
final class RekapController
{
    public function __construct(private readonly RekapService $service) {}

    /**
     * GET /api/reports/daily?date=YYYY-MM-DD. date wajib; kosong, bentuk
     * lain, tanggal yang tidak ada di kalender, atau di luar
     * 1000-01-02..9999-12-31 → invalid_format. Tanggal tanpa data → semua 0.
     */
    public function daily(Request $request): JsonResponse
    {
        $query = QueryParams::from($request);
        if (! $query->has('date')) {
            throw ApiError::validation(['date' => FieldCode::REQUIRED]);
        }
        $date = $query->get('date');
        $rentang = Wib::hari($date) ?? throw ApiError::validation(['date' => FieldCode::INVALID_FORMAT]);

        return ApiResponse::data($this->service->harian($date, $rentang));
    }
}
