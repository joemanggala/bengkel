<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Time\Time;
use App\Support\Time\Wib;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Waktu WIB (UTC+7 tetap): format pesan, tanggal, dan batas hari dalam UTC. */
final class WibTest extends TestCase
{
    private static function utc(string $time): DateTimeImmutable
    {
        return new DateTimeImmutable($time, new DateTimeZone('UTC'));
    }

    /** @return array<string, array{string, string}> */
    public static function dateTimeCases(): array
    {
        return [
            // Dua contoh waktu(t) persis dari spec/whatsapp.md bagian 4.
            'contoh spec, detik dibuang bukan dibulatkan' => ['2026-11-27 07:05:59.999', '27-11-2026 14:05 WIB'],
            'contoh spec, pukul 17 UTC pindah tanggal' => ['2026-11-27 17:00:00.000', '28-11-2026 00:00 WIB'],
            'contoh estimasi selesai di templat SPK' => ['2026-11-28 08:00:00.000', '28-11-2026 15:00 WIB'],
            'tepat tengah malam WIB pindah tanggal' => ['2026-10-31 17:00:00.000', '01-11-2026 00:00 WIB'],
            'lewat tengah malam' => ['2026-10-31 17:30:00.000', '01-11-2026 00:30 WIB'],
            'semenit sebelum tengah malam' => ['2026-12-31 16:59:00.000', '31-12-2026 23:59 WIB'],
            'pergantian tahun' => ['2026-12-31 17:00:00.000', '01-01-2027 00:00 WIB'],
            'jam satu digit diberi nol' => ['2026-01-04 18:09:00.000', '05-01-2026 01:09 WIB'],
        ];
    }

    #[DataProvider('dateTimeCases')]
    public function test_format_date_time_is_numeric_day_month_year(string $utc, string $expected): void
    {
        $this->assertSame($expected, Wib::formatDateTime(self::utc($utc)));
    }

    public function test_format_does_not_depend_on_the_input_time_zone(): void
    {
        $tokyo = new DateTimeImmutable('2026-10-31 16:05:00', new DateTimeZone('Asia/Tokyo'));

        $this->assertSame('31-10-2026 14:05 WIB', Wib::formatDateTime($tokyo));
    }

    public function test_date_switches_at_17_utc(): void
    {
        $this->assertSame('2026-10-31', Wib::tanggal(self::utc('2026-10-31 16:59:00')));
        $this->assertSame('2026-11-01', Wib::tanggal(self::utc('2026-10-31 17:00:00')));
    }

    public function test_a_wib_day_is_the_previous_17_utc_up_to_17_utc(): void
    {
        [$mulai, $akhir] = Wib::hari('2026-10-31');

        $this->assertSame('2026-10-30 17:00:00.000', Time::toDb($mulai));
        $this->assertSame('2026-10-31 17:00:00.000', Time::toDb($akhir));
        $this->assertSame('UTC', $mulai->getTimezone()->getName());

        // Pergantian tahun dan tahun kabisat.
        $this->assertSame('2026-12-31 17:00:00.000', Time::toDb(Wib::hari('2027-01-01')[0]));
        $this->assertNotNull(Wib::hari('2028-02-29'));
    }

    public function test_range_boundaries_are_accepted(): void
    {
        // Hari WIB paling awal masih dimulai di tahun 1000 UTC, di dalam rentang DATETIME MySQL.
        $this->assertSame('1000-01-01 17:00:00.000', Time::toDb(Wib::hari('1000-01-02')[0]));
        $this->assertSame('9999-12-31 17:00:00.000', Time::toDb(Wib::hari('9999-12-31')[1]));
    }

    /** @return array<string, array{string}> */
    public static function invalidDates(): array
    {
        return [
            'kosong' => [''],
            'bukan kabisat' => ['2026-02-29'],
            'tanggal tidak ada' => ['2026-02-30'],
            'bulan 13' => ['2026-13-01'],
            'bulan 0' => ['2026-00-10'],
            'hari 0' => ['2026-10-00'],
            'hari 32' => ['2026-10-32'],
            'tanpa nol di depan' => ['2026-1-01'],
            'tahun dua digit' => ['26-10-31'],
            'urutan hari-bulan-tahun' => ['31-10-2026'],
            'garis miring' => ['2026/10/31'],
            'tanpa pemisah' => ['20261031'],
            'spasi di depan' => [' 2026-10-31'],
            'spasi di belakang' => ['2026-10-31 '],
            'baris baru di belakang' => ["2026-10-31\n"],
            'dengan jam' => ['2026-10-31T00:00:00'],
            'digit lebar penuh' => ['２０２６-10-31'],
            'sebelum batas bawah' => ['0999-12-31'],
            'tahun nol' => ['0000-01-01'],
            '1000-01-01 jendelanya di tahun 0999 UTC' => ['1000-01-01'],
        ];
    }

    #[DataProvider('invalidDates')]
    public function test_invalid_dates_are_refused(string $date): void
    {
        $this->assertNull(Wib::hari($date));
    }

    /** @return array<string, array{string, string}> */
    public static function dateCases(): array
    {
        return [
            'contoh spec' => ['2026-11-27', '27-11-2026'],
            'contoh templat booking' => ['2026-12-01', '01-12-2026'],
            'akhir tahun' => ['2026-12-31', '31-12-2026'],
        ];
    }

    /** tanggal(d) di spec/whatsapp.md: DATE yang sudah WIB, tanpa konversi zona waktu. */
    #[DataProvider('dateCases')]
    public function test_format_date_is_day_month_year_without_time_zone_shift(string $date, string $expected): void
    {
        $this->assertSame($expected, Wib::formatDate($date));
    }

    public function test_calendar_check_and_day_arithmetic(): void
    {
        $this->assertTrue(Wib::tanggalSah('2028-02-29'));
        $this->assertTrue(Wib::tanggalSah('2000-02-29'));
        $this->assertFalse(Wib::tanggalSah('1900-02-29'));
        $this->assertFalse(Wib::tanggalSah('2026-04-31'));
        // Tahun 0000 ada di kalender (kabisat), sama dengan pengurai Go dan JavaScript.
        $this->assertTrue(Wib::tanggalSah('0000-02-29'));
        $this->assertFalse(Wib::tanggalSah("2026-11-27\n"));

        $this->assertSame('2026-12-27', Wib::tambahHari('2026-11-27', 30));
        $this->assertSame('2029-03-01', Wib::tambahHari('2029-02-27', 2));
        $this->assertSame('2028-02-29', Wib::tambahHari('2028-02-28', 1));
        $this->assertSame('2027-01-26', Wib::tambahHari('2026-12-27', 30));
    }
}
