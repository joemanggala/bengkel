<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Jasa;

use App\Modules\Jasa\Requests\JasaInput;
use App\Support\Database\SearchTerm;
use App\Support\Http\ApiResponse;
use App\Support\Http\QueryParams;
use App\Support\Validation\FieldErrors;
use App\Support\Validation\JsonObject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Katalog jasa servis: daftar untuk staf dan website, tambah dan ubah untuk
 * pemilik. Daftar jasa satu bengkel kecil, jadi tidak dipaginasi.
 */
final class JasaController
{
    public function __construct(private readonly JasaService $service) {}

    /** GET /api/services: semua peran staf; jasa nonaktif dan nonpublik ikut. */
    public function index(Request $request): JsonResponse
    {
        $query = QueryParams::from($request);
        $errors = new FieldErrors;
        $isActive = $query->boolean('isActive', $errors);
        $errors->throwIfAny();

        $jasa = $this->service->daftar($isActive, SearchTerm::of($query->search()));

        return ApiResponse::data(array_map(fn (Jasa $j) => $j->toArray(), $jasa));
    }

    /** GET /api/public/services: publik, header Authorization diabaikan. */
    public function publik(): JsonResponse
    {
        return ApiResponse::data(array_map(fn (Jasa $j) => $j->toPublik(), $this->service->publik()));
    }

    /** POST /api/services (pemilik): 422 → 409 service_name_taken → 201. */
    public function store(Request $request): JsonResponse
    {
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $values = JasaInput::buat($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->buat($values)->toArray(), 201);
    }

    /** PATCH /api/services/{serviceId} (pemilik): 404 → 422 → 409 → 200. */
    public function update(Request $request, string $serviceId): JsonResponse
    {
        $this->service->cari($serviceId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $changes = JasaInput::ubah($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->ubah($serviceId, $changes)->toArray());
    }
}
