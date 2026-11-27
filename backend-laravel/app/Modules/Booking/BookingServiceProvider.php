<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking;

use App\Modules\Booking\Contracts\BookingRepositoryInterface;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/** Booking: rute publik /api/public/bookings… dan rute staf /api/bookings… (kecuali …/convert, milik Servis). */
final class BookingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(BookingRepositoryInterface::class, BookingRepository::class);
    }

    /**
     * Urutan alias middleware = urutan pemeriksaan kontrak: json (413/400) →
     * staff (401) → peran (403). Rute publik tidak memakai staff, jadi
     * Authorization diabaikan. Rute tanpa badan (lihat, batal publik, daftar,
     * rincian, konfirmasi) tidak memakai json, jadi badannya diabaikan
     * sepenuhnya, termasuk JSON rusak.
     */
    public function boot(): void
    {
        Route::post('api/public/bookings', [BookingPublikController::class, 'store'])->middleware('json');
        Route::get('api/public/bookings/{bookingToken}', [BookingPublikController::class, 'show']);
        Route::post('api/public/bookings/{bookingToken}/cancel', [BookingPublikController::class, 'cancel']);

        $staf = ['staff', 'peran:owner,cashier'];
        Route::get('api/bookings', [BookingController::class, 'index'])->middleware($staf);
        Route::get('api/bookings/{bookingId}', [BookingController::class, 'show'])->middleware($staf);
        Route::post('api/bookings/{bookingId}/confirm', [BookingController::class, 'confirm'])->middleware($staf);
        Route::post('api/bookings/{bookingId}/reject', [BookingController::class, 'reject'])->middleware(['json', ...$staf]);
    }
}
