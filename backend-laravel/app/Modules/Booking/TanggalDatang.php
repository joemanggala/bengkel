<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking;

use App\Support\Time\Wib;
use App\Support\Validation\FieldCode;
use DateTimeImmutable;

/**
 * Tanggal datang booking (BuatBookingRequest.visitDate): hari ini sampai 30
 * hari ke depan menurut tanggal WIB saat permintaan diterima. Batas ini
 * mencegah booking iseng jauh di masa depan dan booking untuk hari yang
 * sudah lewat; kapasitas per hari tidak dibatasi (staf mengaturnya lewat
 * konfirmasi).
 *
 * Contoh spec: pada 27-11-2026 pukul 23.30 WIB yang sah 2026-11-27 sampai
 * 2026-12-27; pada 27-11-2026 pukul 17.30 UTC (= 28-11-2026 00.30 WIB) yang
 * sah 2026-11-28 sampai 2026-12-28.
 */
final class TanggalDatang
{
    public const MAKS_HARI_KE_DEPAN = 30;

    /**
     * Menilai teks yang tipenya sudah pasti string tidak kosong: bukan
     * YYYY-MM-DD atau tidak ada di kalender → invalid_format; sebelum hari
     * ini atau lebih dari 30 hari sesudahnya → out_of_range; sah → "".
     */
    public static function periksa(string $visitDate, DateTimeImmutable $sekarang): string
    {
        if (! Wib::tanggalSah($visitDate)) {
            return FieldCode::INVALID_FORMAT;
        }
        [$awal, $akhir] = self::rentang($sekarang);

        // Bentuk YYYY-MM-DD bisa dibandingkan sebagai teks.
        return strcmp($visitDate, $awal) < 0 || strcmp($visitDate, $akhir) > 0 ? FieldCode::OUT_OF_RANGE : '';
    }

    /**
     * Tanggal datang paling awal dan paling akhir yang sah saat ini.
     *
     * @return array{0: string, 1: string}
     */
    public static function rentang(DateTimeImmutable $sekarang): array
    {
        $hariIni = Wib::tanggal($sekarang);

        return [$hariIni, Wib::tambahHari($hariIni, self::MAKS_HARI_KE_DEPAN)];
    }
}
