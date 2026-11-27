<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sparepart;

use App\Modules\Sesi\SesiStaf;
use App\Modules\Sparepart\Requests\SparepartInput;
use App\Support\Database\SearchTerm;
use App\Support\Http\ApiResponse;
use App\Support\Http\Page;
use App\Support\Http\QueryParams;
use App\Support\Validation\FieldErrors;
use App\Support\Validation\JsonObject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Daftar sparepart (semua peran staf), tambah dan ubah (khusus pemilik). */
final class SparepartController
{
    public function __construct(private readonly SparepartService $service) {}

    /**
     * GET /api/parts. Semua parameter query dinilai sekaligus (satu 422).
     * Bentuk baris mengikuti peran peminta: pemilik mendapat costPrice,
     * kasir dan mekanik tidak mendapat kuncinya sama sekali.
     */
    public function index(Request $request): JsonResponse
    {
        $query = QueryParams::from($request);
        $errors = new FieldErrors;
        $isActive = $query->boolean('isActive', $errors);
        $lowStock = $query->boolean('lowStock', $errors);
        $page = Page::parse($query, $errors);
        $errors->throwIfAny();

        [$parts, $total] = $this->service->daftar($isActive, $lowStock, SearchTerm::of($query->search()), $page);
        $pemilik = SesiStaf::dari($request)->pemilik();

        return ApiResponse::list(array_map(fn (Sparepart $p) => $p->toArray($pemilik), $parts), $page, $total);
    }

    /** POST /api/parts (pemilik): 422 → 409 sku_taken → 201. */
    public function store(Request $request): JsonResponse
    {
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $values = SparepartInput::buat($body);
        $initialStock = SparepartInput::initialStock($body);
        $body->throwIfInvalid();

        $part = $this->service->buat($values, $initialStock, SesiStaf::dari($request)->staffId);

        return ApiResponse::data($part->toArray(true), 201);
    }

    /** PATCH /api/parts/{partId} (pemilik): 404 → 422 → 409 sku_taken → 200. */
    public function update(Request $request, string $partId): JsonResponse
    {
        $this->service->cari($partId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $changes = SparepartInput::ubah($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->ubah($partId, $changes)->toArray(true));
    }
}
