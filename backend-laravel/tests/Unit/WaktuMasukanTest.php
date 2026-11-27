<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Time\Time;
use App\Support\Time\WaktuMasukan;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Waktu RFC 3339 dari badan permintaan (skema WaktuMasukan), mis. estimasi selesai SPK. */
final class WaktuMasukanTest extends TestCase
{
    /** @return array<string, array{string, string}> */
    public static function validTimes(): array
    {
        return [
            'contoh spec zona +07:00' => ['2026-11-28T15:00:00+07:00', '2026-11-28 08:00:00.000'],
            'contoh spec Z bermilidetik' => ['2026-11-28T08:00:00.000Z', '2026-11-28 08:00:00.000'],
            'tanpa pecahan detik' => ['2026-11-28T08:00:00Z', '2026-11-28 08:00:00.000'],
            'satu digit pecahan = ratusan milidetik' => ['2026-11-28T08:00:00.5Z', '2026-11-28 08:00:00.500'],
            'dua digit pecahan' => ['2026-11-28T08:00:00.05Z', '2026-11-28 08:00:00.050'],
            'zona negatif menggeser tanggal' => ['2026-11-28T20:30:00-05:00', '2026-11-29 01:30:00.000'],
            'zona +14:00 batas atas' => ['2026-11-28T14:00:00+14:00', '2026-11-28 00:00:00.000'],
            'zona -14:00 batas bawah' => ['2026-11-28T00:00:00-14:00', '2026-11-28 14:00:00.000'],
            'zona dengan menit' => ['2026-11-28T08:00:00+05:45', '2026-11-28 02:15:00.000'],
            'tahun kabisat' => ['2028-02-29T00:00:00Z', '2028-02-29 00:00:00.000'],
            'batas bawah rentang' => ['2000-01-01T00:00:00.000Z', '2000-01-01 00:00:00.000'],
            'batas bawah lewat zona' => ['2000-01-01T07:00:00+07:00', '2000-01-01 00:00:00.000'],
            'batas atas rentang' => ['2999-12-31T23:59:59.999Z', '2999-12-31 23:59:59.999'],
            'boleh di masa lalu' => ['2001-01-01T00:00:00Z', '2001-01-01 00:00:00.000'],
        ];
    }

    #[DataProvider('validTimes')]
    public function test_valid_time_is_converted_to_utc_with_milliseconds(string $input, string $utc): void
    {
        [$time, $code] = WaktuMasukan::parse($input);

        $this->assertSame('', $code);
        $this->assertNotNull($time);
        $this->assertSame($utc, Time::toDb($time));
        $this->assertSame('UTC', $time->getTimezone()->getName());
    }

    /** @return array<string, array{string, string}> */
    public static function invalidTimes(): array
    {
        return [
            'tanpa zona' => ['2026-11-28T08:00:00', 'invalid_format'],
            'tanpa detik' => ['2026-11-28T08:00Z', 'invalid_format'],
            'pemisah spasi' => ['2026-11-28 08:00:00Z', 'invalid_format'],
            't kecil' => ['2026-11-28t08:00:00Z', 'invalid_format'],
            'z kecil' => ['2026-11-28T08:00:00z', 'invalid_format'],
            'empat digit pecahan' => ['2026-11-28T08:00:00.0000Z', 'invalid_format'],
            'zona tanpa titik dua' => ['2026-11-28T08:00:00+0700', 'invalid_format'],
            'baris baru di akhir' => ["2026-11-28T08:00:00Z\n", 'invalid_format'],
            'kosong' => ['', 'invalid_format'],
            'kata' => ['besok', 'invalid_format'],
            'tanggal saja' => ['2026-11-28', 'invalid_format'],
            '30 Februari' => ['2026-02-30T08:00:00Z', 'invalid_format'],
            '29 Februari bukan kabisat' => ['2026-02-29T08:00:00Z', 'invalid_format'],
            'bulan 13' => ['2026-13-01T08:00:00Z', 'invalid_format'],
            'hari 0' => ['2026-11-00T08:00:00Z', 'invalid_format'],
            'jam 24' => ['2026-11-28T24:00:00Z', 'invalid_format'],
            'menit 60' => ['2026-11-28T08:60:00Z', 'invalid_format'],
            'detik 60' => ['2026-11-28T08:00:60Z', 'invalid_format'],
            'zona +14:01' => ['2026-11-28T08:00:00+14:01', 'invalid_format'],
            'zona +15:00' => ['2026-11-28T08:00:00+15:00', 'invalid_format'],
            'menit zona 60' => ['2026-11-28T08:00:00+05:60', 'invalid_format'],
            'digit lebar penuh' => ['２０２６-11-28T08:00:00Z', 'invalid_format'],
            'semilidetik sebelum rentang' => ['1999-12-31T23:59:59.999Z', 'out_of_range'],
            'sebelum rentang karena zona' => ['2000-01-01T06:59:59+07:00', 'out_of_range'],
            'sesudah rentang' => ['3000-01-01T00:00:00Z', 'out_of_range'],
            'sesudah rentang karena zona' => ['2999-12-31T23:00:00-01:00', 'out_of_range'],
            'tahun 0000 ada di kalender, tetapi di luar rentang' => ['0000-01-01T00:00:00Z', 'out_of_range'],
            'tahun 9999' => ['9999-12-31T23:59:59-14:00', 'out_of_range'],
        ];
    }

    #[DataProvider('invalidTimes')]
    public function test_invalid_time_gets_one_field_code(string $input, string $code): void
    {
        $this->assertSame([null, $code], WaktuMasukan::parse($input));
    }
}
