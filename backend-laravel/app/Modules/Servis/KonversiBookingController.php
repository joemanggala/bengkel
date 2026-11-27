<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Servis\Requests\SpkInput;
use App\Modules\Sesi\SesiStaf;
use App\Support\Http\ApiResponse;
use App\Support\Validation\JsonObject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Booking dijadikan SPK (pemilik, kasir). Rutenya di bawah /api/bookings,
 * tetapi hasilnya SPK baru, jadi aturannya tinggal di modul Servis bersama
 * pembuatan SPK biasa.
 */
final class KonversiBookingController
{
    public function __construct(
        private readonly KonversiBookingService $konversi,
        private readonly ServisService $servis,
    ) {}

    /**
     * POST /api/bookings/{bookingId}/convert: 404 → 422 (field badan,
     * aturannya sama dengan buat SPK) → 409 booking_transition_invalid → 409
     * plate_owned_by_other_customer → 201. Keluhan disalin dari booking.
     */
    public function jadikan(Request $request, string $bookingId): JsonResponse
    {
        $this->konversi->pastikanBooking($bookingId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $mechanicId = SpkInput::mechanicId($body);
        $odometer = SpkInput::odometer($body);
        $estimatedDoneAt = SpkInput::estimatedDoneAt($body);
        $this->servis->rujukanMekanik($body, $mechanicId);
        $body->throwIfInvalid();

        return ApiResponse::data($this->konversi->jadikan(SesiStaf::dari($request), $bookingId, $mechanicId, $odometer, $estimatedDoneAt), 201);
    }
}
