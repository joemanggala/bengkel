<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Staf;

use App\Modules\Sesi\SesiService;
use App\Modules\Sesi\SesiStaf;
use App\Support\Http\ApiResponse;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Masuk, keluar, dan profil staf yang sedang masuk. */
final class StafController
{
    public function __construct(
        private readonly StafService $service,
        private readonly SesiService $sesi,
    ) {}

    /** POST /api/staff/login. Format email dan panjang sandi tidak divalidasi di sini. */
    public function login(Request $request): JsonResponse
    {
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $email = $body->text('email', new TextRule(trim: true, lowerAscii: true));
        $password = $body->text('password', new TextRule);
        $body->throwIfInvalid();
        $auth = $this->service->masuk($email, $password);

        return ApiResponse::data(['token' => $auth['token'], 'staff' => $auth['staff']->toArray()]);
    }

    /** POST /api/staff/logout: hanya sesi ini; sesi lain milik staf yang sama tetap berlaku. */
    public function logout(Request $request): Response
    {
        $this->sesi->tutup(SesiStaf::dari($request));

        return ApiResponse::noContent();
    }

    /** GET /api/staff/me: peran dibaca ulang dari database setiap permintaan. */
    public function me(Request $request): JsonResponse
    {
        return ApiResponse::data($this->service->profil(SesiStaf::dari($request)->staffId)->toArray());
    }
}
