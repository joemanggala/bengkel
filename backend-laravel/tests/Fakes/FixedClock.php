<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Fakes;

use App\Support\Time\Clock;
use App\Support\Time\Time;
use DateTimeImmutable;
use DateTimeZone;

/** Jam yang hanya bergerak bila digeser tes. */
final class FixedClock extends Clock
{
    private DateTimeImmutable $now;

    public function __construct(string $utc = '2026-10-31 07:00:00.000')
    {
        $this->now = new DateTimeImmutable($utc, new DateTimeZone('UTC'));
    }

    public function now(): DateTimeImmutable
    {
        return $this->now;
    }

    public function advanceSeconds(int $seconds): void
    {
        $this->now = Time::plusSeconds($this->now, $seconds);
    }
}
