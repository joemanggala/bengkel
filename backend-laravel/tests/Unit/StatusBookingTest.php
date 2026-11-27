<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Booking\StatusBooking;
use App\Modules\Booking\TanggalDatang;
use App\Support\Http\ApiError;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Status booking dan batas tanggal datang (hari ini sampai 30 hari ke depan, WIB). */
final class StatusBookingTest extends TestCase
{
    /**
     * Tabel "Status booking" di spec.
     *
     * @return array<string, array{StatusBooking, StatusBooking}>
     */
    public static function allowedTransitions(): array
    {
        return [
            'konfirmasi' => [StatusBooking::Menunggu, StatusBooking::Dikonfirmasi],
            'jadikan SPK dari menunggu' => [StatusBooking::Menunggu, StatusBooking::JadiSpk],
            'jadikan SPK dari dikonfirmasi' => [StatusBooking::Dikonfirmasi, StatusBooking::JadiSpk],
            'tolak dari menunggu' => [StatusBooking::Menunggu, StatusBooking::Ditolak],
            'tolak dari dikonfirmasi (0a-10)' => [StatusBooking::Dikonfirmasi, StatusBooking::Ditolak],
            'pelanggan membatalkan' => [StatusBooking::Menunggu, StatusBooking::Dibatalkan],
        ];
    }

    #[DataProvider('allowedTransitions')]
    public function test_allowed_transition(StatusBooking $from, StatusBooking $to): void
    {
        $this->assertTrue($from->bolehKe($to));
        $from->pastikanBolehKe($to);
    }

    public function test_every_other_pair_is_booking_transition_invalid(): void
    {
        $allowed = [];
        foreach (self::allowedTransitions() as [$from, $to]) {
            $allowed[] = $from->value.'>'.$to->value;
        }

        $checked = 0;
        foreach (StatusBooking::cases() as $from) {
            foreach (StatusBooking::cases() as $to) {
                if (in_array($from->value.'>'.$to->value, $allowed, true)) {
                    continue;
                }
                $this->assertFalse($from->bolehKe($to), $from->value.' → '.$to->value);
                try {
                    $from->pastikanBolehKe($to);
                    $this->fail('seharusnya 409: '.$from->value.' → '.$to->value);
                } catch (ApiError $e) {
                    $this->assertSame([409, 'booking_transition_invalid'], [$e->status, $e->errorCode]);
                }
                $checked++;
            }
        }
        $this->assertSame(25 - 6, $checked);
    }

    public function test_final_statuses_and_labels(): void
    {
        $final = array_values(array_filter(StatusBooking::cases(), fn (StatusBooking $s): bool => $s->akhir()));

        $this->assertSame([StatusBooking::JadiSpk, StatusBooking::Ditolak, StatusBooking::Dibatalkan], $final);
        $this->assertFalse(StatusBooking::Dikonfirmasi->bolehKe(StatusBooking::Dibatalkan), 'pelanggan hanya bisa membatalkan selagi menunggu');
        $this->assertSame(['Menunggu', 'Dikonfirmasi', 'Jadi SPK', 'Ditolak', 'Dibatalkan'],
            array_map(fn (StatusBooking $s): string => $s->label(), StatusBooking::cases()));
        $this->assertSame(['PENDING', 'CONFIRMED', 'CONVERTED', 'REJECTED', 'CANCELLED'],
            array_map(fn (StatusBooking $s): string => $s->value, StatusBooking::cases()));
    }

    /** @return array<string, array{string, string, string}> */
    public static function visitDates(): array
    {
        // Dua contoh pertama persis dari deskripsi BuatBookingRequest.visitDate.
        $malam = '2026-11-27 16:30:00';
        $lewatTengahMalam = '2026-11-27 17:30:00';

        return [
            'contoh spec 23.30 WIB: hari ini sah' => [$malam, '2026-11-27', ''],
            'contoh spec 23.30 WIB: 30 hari lagi sah' => [$malam, '2026-12-27', ''],
            'contoh spec 23.30 WIB: 31 hari lagi' => [$malam, '2026-12-28', 'out_of_range'],
            'contoh spec 23.30 WIB: kemarin' => [$malam, '2026-11-26', 'out_of_range'],
            'contoh spec 00.30 WIB: tanggal UTC sudah kemarin' => [$lewatTengahMalam, '2026-11-27', 'out_of_range'],
            'contoh spec 00.30 WIB: hari ini sah' => [$lewatTengahMalam, '2026-11-28', ''],
            'contoh spec 00.30 WIB: 30 hari lagi sah' => [$lewatTengahMalam, '2026-12-28', ''],
            'contoh spec 00.30 WIB: 31 hari lagi' => [$lewatTengahMalam, '2026-12-29', 'out_of_range'],
            'tanggal tidak ada' => [$malam, '2026-02-30', 'invalid_format'],
            'bentuk lain' => [$malam, '27-11-2026', 'invalid_format'],
            'dengan jam' => [$malam, '2026-11-27T10:00:00', 'invalid_format'],
            'baris baru di akhir' => [$malam, "2026-11-27\n", 'invalid_format'],
            'tahun 0000 ada di kalender' => [$malam, '0000-01-01', 'out_of_range'],
        ];
    }

    #[DataProvider('visitDates')]
    public function test_visit_date_window_follows_the_wib_date(string $nowUtc, string $visitDate, string $code): void
    {
        $now = new DateTimeImmutable($nowUtc, new DateTimeZone('UTC'));

        $this->assertSame($code, TanggalDatang::periksa($visitDate, $now));
    }

    public function test_window_bounds(): void
    {
        $now = new DateTimeImmutable('2026-12-15 03:00:00', new DateTimeZone('UTC'));

        $this->assertSame(['2026-12-15', '2027-01-14'], TanggalDatang::rentang($now));
    }
}
