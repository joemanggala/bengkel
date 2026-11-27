<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Time;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/**
 * Format waktu yang dipakai bersama: kolom DATETIME(3) di database dan
 * date-time UTC di JSON. Keduanya selalu UTC dengan tepat tiga digit
 * milidetik.
 */
final class Time
{
    /** Format kolom DATETIME(3); tanpa ".v" milidetiknya hilang saat ditulis. */
    public const DB_FORMAT = 'Y-m-d H:i:s.v';

    public const JSON_FORMAT = 'Y-m-d\TH:i:s.v\Z';

    public static function toDb(DateTimeImmutable $time): string
    {
        return self::utc($time)->format(self::DB_FORMAT);
    }

    public static function toJson(DateTimeImmutable $time): string
    {
        return self::utc($time)->format(self::JSON_FORMAT);
    }

    /** Nilai DATETIME(3) dari database, mis. "2026-10-31 07:05:00.123". */
    public static function fromDb(string $value): DateTimeImmutable
    {
        $utc = new DateTimeZone('UTC');
        $time = DateTimeImmutable::createFromFormat('!'.self::DB_FORMAT, $value, $utc)
            ?: DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, $utc);
        if ($time === false) {
            throw new InvalidArgumentException('waktu dari database tidak terbaca: '.$value);
        }

        return $time;
    }

    /** Kolom waktu dari database langsung ke teks JSON; null tetap null. */
    public static function dbToJson(?string $value): ?string
    {
        return $value === null ? null : self::toJson(self::fromDb($value));
    }

    public static function plusSeconds(DateTimeImmutable $time, int $seconds): DateTimeImmutable
    {
        return $time->modify(sprintf('%+d seconds', $seconds));
    }

    /** Milidetik sejak epoch, untuk menghitung selisih waktu dengan tepat. */
    public static function millis(DateTimeImmutable $time): int
    {
        return (int) $time->format('U') * 1000 + (int) $time->format('v');
    }

    /** Membuang digit di bawah milidetik (bukan membulatkan). */
    public static function truncateToMillis(DateTimeImmutable $time): DateTimeImmutable
    {
        return $time->setTime(
            (int) $time->format('H'),
            (int) $time->format('i'),
            (int) $time->format('s'),
            intdiv((int) $time->format('u'), 1000) * 1000,
        );
    }

    private static function utc(DateTimeImmutable $time): DateTimeImmutable
    {
        return $time->setTimezone(new DateTimeZone('UTC'));
    }
}
