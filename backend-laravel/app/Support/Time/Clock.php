<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Time;

use DateTimeImmutable;
use DateTimeZone;

/**
 * Jam aplikasi.
 *
 * Semua waktu yang ditulis dan dibandingkan backend (kedaluwarsa sesi,
 * waktu SPK dibuat, waktu pembayaran) berasal dari sini, bukan dari
 * NOW() MySQL. Dengan satu sumber waktu, perilaku tidak bergantung pada zona
 * waktu sesi database, dan unit test bisa memakai jam palsu.
 */
class Clock
{
    /**
     * Waktu sekarang dalam UTC, dipotong ke milidetik. Kolom DATETIME(3) hanya
     * menyimpan milidetik, dan MySQL membulatkan (bukan memotong) digit
     * sisanya; dengan memotong di sini, nilai di memori sama persis dengan
     * nilai yang nanti dibaca ulang dari database.
     */
    public function now(): DateTimeImmutable
    {
        return Time::truncateToMillis(new DateTimeImmutable('now', new DateTimeZone('UTC')));
    }
}
