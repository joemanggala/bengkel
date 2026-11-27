<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking;

use App\Support\Database\SearchTerm;
use App\Support\Http\QueryParams;
use App\Support\Time\Wib;
use App\Support\Validation\FieldCode;
use App\Support\Validation\FieldErrors;

/**
 * Filter GET /api/bookings yang sudah divalidasi: status, tanggal datang, dan
 * pencarian. Null berarti filter itu tidak dipakai.
 */
final class FilterBooking
{
    public function __construct(
        public readonly ?StatusBooking $status,
        public readonly ?string $visitDate,
        public readonly SearchTerm $search,
    ) {}

    /**
     * Galat dicatat ke $errors supaya dilaporkan bersama page dan limit dalam
     * satu balasan 422. Status dibandingkan persis (huruf besar); kosong atau
     * nilai lain → invalid_format. visitDate harus YYYY-MM-DD yang ada di
     * kalender.
     */
    public static function dari(QueryParams $query, FieldErrors $errors): self
    {
        $status = null;
        if ($query->has('status')) {
            $status = StatusBooking::tryFrom($query->get('status'));
            if ($status === null) {
                $errors->add('status', FieldCode::INVALID_FORMAT);
            }
        }
        $visitDate = null;
        if ($query->has('visitDate')) {
            $visitDate = $query->get('visitDate');
            if (! Wib::tanggalSah($visitDate)) {
                $errors->add('visitDate', FieldCode::INVALID_FORMAT);
                $visitDate = null;
            }
        }

        return new self($status, $visitDate, SearchTerm::of($query->search()));
    }
}
