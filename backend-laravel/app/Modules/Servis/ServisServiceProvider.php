<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Servis\Contracts\KonversiRepositoryInterface;
use App\Modules\Servis\Contracts\ServisRepositoryInterface;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/** SPK: /api/work-orders…, /api/vehicles/{vehicleId}/work-orders, /api/bookings/{bookingId}/convert, dan /api/public/work-orders/{trackingToken}. */
final class ServisServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(ServisRepositoryInterface::class, ServisRepository::class);
        $this->app->bind(KonversiRepositoryInterface::class, KonversiRepository::class);
    }

    /**
     * Urutan alias middleware = urutan pemeriksaan kontrak: json (413/400) →
     * staff (401) → peran (403). Rincian, PATCH, dan status boleh dipanggil
     * ketiga peran, jadi tidak memakai middleware peran; batas mekanik (hanya
     * SPK miliknya) dinilai controller sesudah 404. Rute tanpa badan (daftar,
     * rincian, hapus item, tautan lacak) tidak memakai json, jadi badannya
     * diabaikan sepenuhnya. Rute publik tidak memakai staff.
     */
    public function boot(): void
    {
        $kasir = 'peran:owner,cashier';

        Route::get('api/public/work-orders/{trackingToken}', [LacakController::class, 'show']);

        Route::get('api/work-orders', [SpkController::class, 'index'])->middleware('staff');
        Route::post('api/work-orders', [SpkController::class, 'store'])->middleware(['json', 'staff', $kasir]);
        Route::get('api/work-orders/{number}', [SpkController::class, 'show'])->middleware('staff');
        Route::patch('api/work-orders/{number}', [SpkController::class, 'update'])->middleware(['json', 'staff']);
        Route::post('api/work-orders/{number}/status', [SpkController::class, 'status'])->middleware(['json', 'staff']);
        Route::post('api/work-orders/{number}/cancel', [SpkController::class, 'cancel'])->middleware(['json', 'staff', $kasir]);

        Route::post('api/work-orders/{number}/items', [AksiSpkController::class, 'tambah'])->middleware(['json', 'staff', $kasir]);
        Route::delete('api/work-orders/{number}/items/{itemId}', [AksiSpkController::class, 'hapus'])->middleware(['staff', $kasir]);
        Route::post('api/work-orders/{number}/payments', [AksiSpkController::class, 'bayar'])->middleware(['json', 'staff', $kasir]);
        Route::post('api/work-orders/{number}/wa', [AksiSpkController::class, 'wa'])->middleware(['json', 'staff', $kasir]);
        Route::post('api/work-orders/{number}/tracking-link', [AksiSpkController::class, 'tautanLacak'])->middleware(['staff', $kasir]);

        Route::get('api/vehicles/{vehicleId}/work-orders', [SpkController::class, 'riwayat'])->middleware(['staff', $kasir]);
        Route::post('api/bookings/{bookingId}/convert', [KonversiBookingController::class, 'jadikan'])->middleware(['json', 'staff', $kasir]);
    }
}
