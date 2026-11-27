<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking;

use App\Modules\Booking\Requests\BuatBookingInput;
use App\Support\Http\ApiResponse;
use App\Support\Time\Clock;
use App\Support\Validation\JsonObject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Booking dari website tanpa akun. Rute publik tidak memeriksa
 * Authorization sama sekali (tidak memakai middleware staff), jadi token
 * staf yang ikut terkirim tidak mengubah apa pun.
 */
final class BookingPublikController
{
    public function __construct(
        private readonly BookingService $service,
        private readonly Clock $clock,
    ) {}

    /**
     * POST /api/public/bookings: 413 → 400 (middleware json) → 422 (semua
     * field sekaligus, termasuk rujukan serviceId) → 409 → 201.
     */
    public function store(Request $request): JsonResponse
    {
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $isian = BuatBookingInput::baca($body, $this->clock->now());
        $serviceName = null;
        if ($isian->serviceId !== null) {
            [$serviceName, $kode] = $this->service->rujukanJasa($isian->serviceId);
            $body->fail('serviceId', $kode);
        }
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->buat($isian, $serviceName), 201);
    }

    /** GET /api/public/bookings/{bookingToken} */
    public function show(string $bookingToken): JsonResponse
    {
        return ApiResponse::data($this->service->lihatPublik($bookingToken));
    }

    /** POST /api/public/bookings/{bookingToken}/cancel: tanpa badan (badan diabaikan). */
    public function cancel(string $bookingToken): JsonResponse
    {
        return ApiResponse::data($this->service->batalkanPublik($bookingToken));
    }
}
