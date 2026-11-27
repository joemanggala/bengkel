<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking;

use App\Modules\Sesi\SesiStaf;
use App\Support\Http\ApiResponse;
use App\Support\Http\Page;
use App\Support\Http\QueryParams;
use App\Support\Validation\FieldErrors;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Booking di panel staf (pemilik dan kasir): daftar, rincian, konfirmasi, dan tolak. */
final class BookingController
{
    public function __construct(private readonly BookingService $service) {}

    /** GET /api/bookings: 422 untuk semua parameter query yang salah sekaligus. */
    public function index(Request $request): JsonResponse
    {
        $query = QueryParams::from($request);
        $errors = new FieldErrors;
        $filter = FilterBooking::dari($query, $errors);
        $page = Page::parse($query, $errors);
        $errors->throwIfAny();
        [$items, $total] = $this->service->daftar($filter, $page);

        return ApiResponse::list($items, $page, $total);
    }

    /** GET /api/bookings/{bookingId} */
    public function show(string $bookingId): JsonResponse
    {
        return ApiResponse::data($this->service->rincian($bookingId));
    }

    /** POST /api/bookings/{bookingId}/confirm: tanpa badan (badan diabaikan). */
    public function confirm(Request $request, string $bookingId): JsonResponse
    {
        return ApiResponse::data($this->service->konfirmasi(SesiStaf::dari($request), $bookingId));
    }

    /**
     * POST /api/bookings/{bookingId}/reject: 404 lebih dulu, baru alasan
     * divalidasi (422), lalu perpindahan status (409).
     */
    public function reject(Request $request, string $bookingId): JsonResponse
    {
        $this->service->pastikanAda($bookingId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $reason = $body->text('reason', new TextRule(trim: true, min: 3, max: 500));
        $body->throwIfInvalid();

        return ApiResponse::data($this->service->tolak(SesiStaf::dari($request), $bookingId, $reason));
    }
}
