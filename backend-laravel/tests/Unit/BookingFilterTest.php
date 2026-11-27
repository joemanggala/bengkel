<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Booking\FilterBooking;
use App\Modules\Booking\StatusBooking;
use App\Support\Http\QueryParams;
use App\Support\Validation\FieldErrors;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Filter GET /api/bookings: status persis, tanggal datang sah, dan search yang dipangkas. */
final class BookingFilterTest extends TestCase
{
    public function test_tanpa_parameter_berarti_tanpa_filter(): void
    {
        $errors = new FieldErrors;
        $filter = FilterBooking::dari(QueryParams::parse(''), $errors);

        $this->assertTrue($errors->isEmpty());
        $this->assertNull($filter->status);
        $this->assertNull($filter->visitDate);
        $this->assertTrue($filter->search->isEmpty());
    }

    public function test_nilai_sah_dibaca_dan_search_dipangkas(): void
    {
        $errors = new FieldErrors;
        $filter = FilterBooking::dari(QueryParams::parse('status=CONFIRMED&visitDate=2028-02-29&search=+joko+'), $errors);

        $this->assertTrue($errors->isEmpty());
        $this->assertSame(StatusBooking::Dikonfirmasi, $filter->status);
        $this->assertSame('2028-02-29', $filter->visitDate);
        $this->assertSame('joko', $filter->search->term);
    }

    /** @return array<string, array{string, array<string, string>}> */
    public static function queryTidakSah(): array
    {
        return [
            'status kosong' => ['status=', ['status' => 'invalid_format']],
            'status huruf kecil' => ['status=pending', ['status' => 'invalid_format']],
            'status SPK' => ['status=DONE', ['status' => 'invalid_format']],
            'visitDate kosong' => ['visitDate=', ['visitDate' => 'invalid_format']],
            'visitDate DD-MM-YYYY' => ['visitDate=28-11-2026', ['visitDate' => 'invalid_format']],
            'visitDate 30 Februari' => ['visitDate=2026-02-30', ['visitDate' => 'invalid_format']],
            'visitDate dengan jam' => ['visitDate=2026-11-28T00:00:00', ['visitDate' => 'invalid_format']],
            'keduanya' => ['status=x&visitDate=x', ['status' => 'invalid_format', 'visitDate' => 'invalid_format']],
        ];
    }

    /** @param  array<string, string>  $fields */
    #[DataProvider('queryTidakSah')]
    public function test_query_tidak_sah_dicatat_invalid_format(string $query, array $fields): void
    {
        $errors = new FieldErrors;
        FilterBooking::dari(QueryParams::parse($query), $errors);

        $this->assertSame($fields, $errors->all());
    }
}
