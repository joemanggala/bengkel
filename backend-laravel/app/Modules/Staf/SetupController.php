<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Staf;

use App\Modules\Staf\Requests\StafInput;
use App\Support\Config\Settings;
use App\Support\Http\ApiError;
use App\Support\Http\ApiResponse;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Pemasangan awal: membuat akun pemilik pertama, sekali saja. */
final class SetupController
{
    public function __construct(private readonly StafService $service) {}

    /** GET /api/setup: publik; tidak bergantung pada SETUP_TOKEN. */
    public function status(): JsonResponse
    {
        return ApiResponse::data(['needsSetup' => $this->service->perluPemasangan()]);
    }

    /**
     * POST /api/setup. Urutan: SETUP_TOKEN kosong → 403 apa pun badannya;
     * lalu validasi semua field → 422; baru token dibandingkan → 403; lalu
     * 409 bila sudah ada staf.
     */
    public function pasang(Request $request, Settings $settings): JsonResponse
    {
        if ($settings->setupToken === '') {
            throw ApiError::of(403, 'setup_disabled');
        }
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        // Token tidak dipangkas: yang dikirim harus sama persis dengan env.
        $token = $body->text('token', new TextRule);
        $name = StafInput::name($body);
        $email = StafInput::email($body);
        $password = StafInput::password($body);
        $body->throwIfInvalid();
        // Waktu-konstan, supaya lama perbandingan tidak membocorkan isi token.
        if (! hash_equals($settings->setupToken, $token)) {
            throw ApiError::of(403, 'setup_token_invalid');
        }
        $auth = $this->service->pasangPemilik($name, $email, $password);

        return ApiResponse::data(['token' => $auth['token'], 'staff' => $auth['staff']->toArray()], 201);
    }
}
