<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Time;

use App\Support\Validation\FieldCode;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Waktu dari badan permintaan (skema WaktuMasukan), mis. estimasi selesai
 * SPK: RFC 3339 dengan detik dan zona waktu wajib,
 * "2026-11-28T15:00:00+07:00" atau "2026-11-28T08:00:00.000Z".
 *
 * Pengurai tanggal bawaan PHP (new DateTimeImmutable, strtotime) sengaja
 * tidak dipakai untuk menilai bentuknya: keduanya menerima banyak bentuk lain
 * ("tomorrow", "2026-11-28 15:00", jam 24:00) dan diam-diam menggeser tanggal
 * yang tidak ada (30 Februari menjadi 2 Maret). Kontrak menuntut bentuk yang
 * persis sama di ketiga backend, jadi setiap bagiannya diperiksa di sini.
 */
final class WaktuMasukan
{
    /** Huruf T dan Z wajib besar; pecahan detik 1 sampai 3 digit. */
    private const POLA = '/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,3}))?(Z|([+-])([0-9]{2}):([0-9]{2}))$/D';

    /** Batas selisih zona waktu: ±14:00, dalam menit. */
    private const SELISIH_MAKS_MENIT = 14 * 60;

    /** Rentang yang diterima sesudah diubah ke UTC, dalam format kolom DATETIME(3). */
    private const PALING_AWAL = '2000-01-01 00:00:00.000';

    private const PALING_AKHIR = '2999-12-31 23:59:59.999';

    /**
     * Teks yang tidak cocok pola, tanggal yang tidak ada di kalender, jam di
     * luar 00–23, menit atau detik di luar 00–59, atau selisih zona di luar
     * ±14:00 → invalid_format. Sesudah diubah ke UTC, di luar
     * 2000-01-01T00:00:00.000Z sampai 2999-12-31T23:59:59.999Z → out_of_range.
     *
     * @return array{0: DateTimeImmutable|null, 1: string} waktu UTC bermilidetik dan kode aturan ("" bila sah)
     */
    public static function parse(string $text): array
    {
        if (preg_match(self::POLA, $text, $m, PREG_UNMATCHED_AS_NULL) !== 1) {
            return [null, FieldCode::INVALID_FORMAT];
        }
        [$tahun, $bulan, $hari, $jam, $menit, $detik] = array_map('intval', array_slice($m, 1, 6));
        if ($bulan < 1 || $bulan > 12 || $hari < 1 || $hari > Wib::jumlahHari($tahun, $bulan)
            || $jam > 23 || $menit > 59 || $detik > 59) {
            return [null, FieldCode::INVALID_FORMAT];
        }
        $selisih = 0;
        if ($m[8] !== 'Z') {
            $jamZona = (int) $m[10];
            $menitZona = (int) $m[11];
            $selisih = $jamZona * 60 + $menitZona;
            if ($menitZona > 59 || $selisih > self::SELISIH_MAKS_MENIT) {
                return [null, FieldCode::INVALID_FORMAT];
            }
            if ($m[9] === '-') {
                $selisih = -$selisih;
            }
        }
        // Pecahan detik dilengkapi menjadi milidetik: ".5" = 500 ms.
        $milidetik = $m[7] === null ? 0 : (int) str_pad($m[7], 3, '0');
        $utc = (new DateTimeImmutable('@0'))->setTimezone(new DateTimeZone('UTC'))
            ->setDate($tahun, $bulan, $hari)
            ->setTime($jam, $menit, $detik, $milidetik * 1000)
            ->modify(sprintf('%+d minutes', -$selisih));
        $ms = Time::millis($utc);
        if ($ms < Time::millis(Time::fromDb(self::PALING_AWAL)) || $ms > Time::millis(Time::fromDb(self::PALING_AKHIR))) {
            return [null, FieldCode::OUT_OF_RANGE];
        }

        return [$utc, ''];
    }
}
