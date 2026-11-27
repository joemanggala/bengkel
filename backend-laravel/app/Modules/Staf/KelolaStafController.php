<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Staf;

use App\Modules\Sesi\SesiStaf;
use App\Modules\Staf\Requests\StafInput;
use App\Support\Http\ApiResponse;
use App\Support\Validation\JsonObject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Akun staf (khusus pemilik) dan daftar mekanik aktif untuk penugasan (pemilik dan kasir). */
final class KelolaStafController
{
    public function __construct(private readonly StafService $service) {}

    /** GET /api/staff: semua staf termasuk yang nonaktif, tanpa paginasi. */
    public function index(): JsonResponse
    {
        return ApiResponse::data(array_map(fn (Staf $staf) => $staf->toArray(), $this->service->daftar()));
    }

    /** GET /api/mechanics: mekanik aktif {staffId, name}, tanpa email (keputusan 0a-2). */
    public function mechanics(): JsonResponse
    {
        return ApiResponse::data($this->service->mekanikAktif());
    }

    /** POST /api/staff */
    public function store(Request $request): JsonResponse
    {
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $name = StafInput::name($body);
        $email = StafInput::email($body);
        $password = StafInput::password($body);
        $role = StafInput::role($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->buat($name, $email, $password, $role)->toArray(), 201);
    }

    /**
     * PATCH /api/staff/{staffId}: 404 lebih dulu, baru badan divalidasi.
     * Hanya field yang dikirim yang dinilai dan diubah.
     */
    public function update(Request $request, string $staffId): JsonResponse
    {
        $this->service->cari($staffId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $perubahan = new PerubahanStaf(
            $body->has('name') ? StafInput::name($body) : null,
            $body->has('email') ? StafInput::email($body) : null,
            $body->has('password') ? StafInput::password($body) : null,
            $body->has('role') ? StafInput::role($body) : null,
            $body->has('isActive') ? $body->bool('isActive', optional: true) : null,
        );
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->ubah(SesiStaf::dari($request), $staffId, $perubahan)->toArray());
    }
}
