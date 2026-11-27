<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Pelanggan;

use App\Modules\Pelanggan\Requests\PelangganInput;
use App\Support\Database\SearchTerm;
use App\Support\Http\ApiResponse;
use App\Support\Http\Page;
use App\Support\Http\QueryParams;
use App\Support\Validation\JsonObject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * /api/customers…: cari, catat, lihat, dan ubah pelanggan (pemilik dan
 * kasir). Peran sudah diperiksa middleware; urutan sisanya 404 → 422 → 409.
 */
final class PelangganController
{
    public function __construct(private readonly PelangganService $service) {}

    /** GET /api/customers: search mencocokkan nama, nomor HP, atau plat kendaraannya. */
    public function index(Request $request): JsonResponse
    {
        $query = QueryParams::from($request);
        $page = Page::fromQuery($query);
        [$items, $total] = $this->service->daftar(SearchTerm::of($query->search()), $page);

        return ApiResponse::list(array_map(fn (Pelanggan $p): array => $p->toArray(), $items), $page, $total);
    }

    /** POST /api/customers: 201 dengan vehicles kosong. */
    public function store(Request $request): JsonResponse
    {
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $kolom = PelangganInput::baru($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->buat($kolom)->toArray(), 201);
    }

    /** GET /api/customers/{customerId} */
    public function show(string $customerId): JsonResponse
    {
        return ApiResponse::data($this->service->cari($customerId)->toArray());
    }

    /** PATCH /api/customers/{customerId}: 404 lebih dulu, baru badan dinilai. */
    public function update(Request $request, string $customerId): JsonResponse
    {
        $this->service->pastikanAda($customerId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $changes = PelangganInput::perubahan($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->ubah($customerId, $changes)->toArray());
    }
}
