<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking;

use App\Support\Http\ApiError;

/**
 * Status booking (StatusBooking). Nilainya sama dengan kolom bookings.status.
 *
 *   PENDING → CONFIRMED → CONVERTED;  PENDING → CONVERTED
 *   PENDING, CONFIRMED → REJECTED (staf, wajib alasan)
 *   PENDING → CANCELLED (pelanggan)
 *
 * CONVERTED, REJECTED, dan CANCELLED adalah status akhir. Booking dari form
 * publik bisa diisi siapa saja, jadi semuanya mulai PENDING dan harus
 * diterima staf (keputusan rancangan nomor 4).
 */
enum StatusBooking: string
{
    case Menunggu = 'PENDING';

    case Dikonfirmasi = 'CONFIRMED';

    case JadiSpk = 'CONVERTED';

    case Ditolak = 'REJECTED';

    case Dibatalkan = 'CANCELLED';

    /** Label Indonesia (x-label StatusBooking). */
    public function label(): string
    {
        return match ($this) {
            self::Menunggu => 'Menunggu',
            self::Dikonfirmasi => 'Dikonfirmasi',
            self::JadiSpk => 'Jadi SPK',
            self::Ditolak => 'Ditolak',
            self::Dibatalkan => 'Dibatalkan',
        };
    }

    /**
     * Perpindahan yang tertulis di tabel "Status booking" spec. Ke status yang
     * sama, dari status akhir, dan CONFIRMED → CANCELLED (pelanggan hanya
     * bisa membatalkan selagi menunggu) tidak sah. REJECTED boleh dari
     * PENDING maupun CONFIRMED (keputusan 0a-10).
     */
    public function bolehKe(self $tujuan): bool
    {
        return match ($tujuan) {
            self::Dikonfirmasi, self::Dibatalkan => $this === self::Menunggu,
            self::JadiSpk, self::Ditolak => $this === self::Menunggu || $this === self::Dikonfirmasi,
            self::Menunggu => false,
        };
    }

    /** Perpindahan tidak sah → 409 booking_transition_invalid. */
    public function pastikanBolehKe(self $tujuan): void
    {
        if (! $this->bolehKe($tujuan)) {
            throw ApiError::conflict('booking_transition_invalid');
        }
    }

    /** Status akhir: tidak ada perpindahan apa pun lagi. */
    public function akhir(): bool
    {
        return $this === self::JadiSpk || $this === self::Ditolak || $this === self::Dibatalkan;
    }
}
