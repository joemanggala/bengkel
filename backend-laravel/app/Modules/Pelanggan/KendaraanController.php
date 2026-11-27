<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Pelanggan;

use App\Modules\Pelanggan\Requests\KendaraanInput;
use App\Support\Http\ApiResponse;
use App\Support\Http\Page;
use App\Support\Http\QueryParams;
use App\Support\Validation\FieldErrors;
use App\Support\Validation\JsonObject;
use App\Support\Validation\Plate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Kendaraan: tambah untuk seorang pelanggan, cari dari plat, dan ubah
 * (pemilik dan kasir). Riwayat servis kendaraan milik modul Servis.
 */
final class KendaraanController
{
    public function __construct(private readonly PelangganService $service) {}

    /** POST /api/customers/{customerId}/vehicles: 404 pelanggan → 422 → 409 plate_taken. */
    public function store(Request $request, string $customerId): JsonResponse
    {
        $this->service->pastikanAda($customerId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $kolom = KendaraanInput::baru($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->tambahKendaraan($customerId, $kolom)->toArray(), 201);
    }

    /**
     * GET /api/vehicles?plate=: plate, page, dan limit dinilai bersama supaya
     * semua galat query dilaporkan dalam satu balasan 422.
     */
    public function index(Request $request): JsonResponse
    {
        $query = QueryParams::from($request);
        $errors = new FieldErrors;
        [$bagianKunci, $kode] = Plate::query($query->get('plate'));
        $errors->add('plate', $kode);
        $page = Page::parse($query, $errors);
        $errors->throwIfAny();

        [$items, $total] = $this->service->cariPlat($bagianKunci, $page);

        return ApiResponse::list(array_map(fn (array $baris): array => [
            'vehicle' => $baris['vehicle']->toArray(),
            'customer' => $baris['customer'],
        ], $items), $page, $total);
    }

    /** PATCH /api/vehicles/{vehicleId}: 404 lebih dulu; pemilik kendaraan tidak bisa diganti. */
    public function update(Request $request, string $vehicleId): JsonResponse
    {
        $this->service->cariKendaraan($vehicleId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $changes = KendaraanInput::perubahan($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->ubahKendaraan($vehicleId, $changes)->toArray());
    }
}
