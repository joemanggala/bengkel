<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Time;

use DateTimeImmutable;
use DateTimeZone;

/**
 * Waktu Indonesia Barat (UTC+7) untuk semua yang dibaca manusia: pesan
 * WhatsApp, filter tanggal SPK, batas tanggal datang booking, dan rekap
 * harian (spec, bagian "Waktu").
 *
 * Database menyimpan UTC, sedangkan bengkel hidup di WIB: SPK yang dibuat
 * pukul 01.00 WIB tercatat pukul 18.00 UTC hari sebelumnya. Tanpa konversi,
 * rekap "hari ini" akan memotong hari di jam 07.00 pagi WIB.
 *
 * WIB ditulis sebagai selisih tetap +07:00, bukan "Asia/Jakarta": data zona
 * waktu tidak selalu terpasang (mis. image Docker minimal), dan WIB tidak
 * mengenal jam musim panas. Pembagian hari juga dihitung di aplikasi, bukan
 * dengan CONVERT_TZ MySQL, supaya tidak bergantung pada tabel zona waktu
 * database.
 */
final class Wib
{
    private const OFFSET = '+07:00';

    /** Tanggal paling awal yang diterima: jendela UTC harinya masih di dalam rentang DATETIME MySQL. */
    private const EARLIEST = '1000-01-02';

    /**
     * Satu hari kalender WIB sebagai rentang UTC [mulai, akhir), langsung
     * dipakai di query: created_at >= mulai AND created_at < akhir. Null bila
     * bentuknya bukan YYYY-MM-DD persis, tanggalnya tidak ada di kalender
     * (2026-02-30), atau di luar 1000-01-02..9999-12-31 (parameter TanggalRekap
     * dan TanggalFilter). Batas bawahnya bukan 1000-01-01 karena hari WIB itu
     * dimulai di tahun 0999 UTC.
     *
     * @return array{0: DateTimeImmutable, 1: DateTimeImmutable}|null
     */
    public static function hari(string $date): ?array
    {
        if (! self::tanggalSah($date) || strcmp($date, self::EARLIEST) < 0) {
            return null;
        }
        $mulai = (new DateTimeImmutable($date.' 00:00:00'.self::OFFSET))->setTimezone(new DateTimeZone('UTC'));

        return [$mulai, $mulai->modify('+1 day')];
    }

    /**
     * Apakah teks berbentuk YYYY-MM-DD persis (digit ASCII, tanpa spasi atau
     * baris baru) dan tanggalnya ada di kalender. 2026-02-30 dan 2026-13-01
     * tidak sah; 0000-01-01 sah (lihat jumlahHari).
     */
    public static function tanggalSah(string $date): bool
    {
        if (preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D', $date, $m) !== 1) {
            return false;
        }
        [$tahun, $bulan, $hari] = [(int) $m[1], (int) $m[2], (int) $m[3]];

        return $bulan >= 1 && $bulan <= 12 && $hari >= 1 && $hari <= self::jumlahHari($tahun, $bulan);
    }

    /**
     * Jumlah hari dalam bulan menurut kalender Gregorius proleptik, termasuk
     * tahun 0000 (kabisat). checkdate() PHP tidak dipakai karena menolak
     * tahun 0000, padahal pengurai tanggal Go dan JavaScript menerimanya:
     * tanggal sedini itu harus dinilai di luar rentang (out_of_range), bukan
     * "tidak ada di kalender" (invalid_format), supaya ketiga backend sama.
     */
    public static function jumlahHari(int $tahun, int $bulan): int
    {
        $kabisat = $tahun % 4 === 0 && ($tahun % 100 !== 0 || $tahun % 400 === 0);

        return match ($bulan) {
            2 => $kabisat ? 29 : 28,
            4, 6, 9, 11 => 30,
            default => 31,
        };
    }

    /**
     * waktu(t) di spec/whatsapp.md: UTC + 7 jam, "DD-MM-YYYY HH:MM WIB", 24 jam,
     * dua digit dengan nol di depan. Detik dan milidetik dibuang (bukan
     * dibulatkan), sama seperti jam dinding: 07:05:59.999 UTC → 14:05 WIB.
     */
    public static function formatDateTime(DateTimeImmutable $time): string
    {
        return self::keWib($time)->format('d-m-Y H:i').' WIB';
    }

    /**
     * tanggal(d) di spec/whatsapp.md: kolom DATE yang sudah WIB (tanggal datang
     * booking) ditulis "DD-MM-YYYY" apa adanya, tanpa konversi zona waktu.
     * "2026-11-27" → "27-11-2026". Teks yang bukan YYYY-MM-DD dikembalikan
     * tanpa diubah; kolom DATE dari database selalu berbentuk itu.
     */
    public static function formatDate(string $date): string
    {
        if (preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D', $date, $m) !== 1) {
            return $date;
        }

        return $m[3].'-'.$m[2].'-'.$m[1];
    }

    /** Tanggal WIB dari suatu waktu, "YYYY-MM-DD". */
    public static function tanggal(DateTimeImmutable $time): string
    {
        return self::keWib($time)->format('Y-m-d');
    }

    /**
     * Tanggal kalender "YYYY-MM-DD" ditambah sekian hari, tanpa jam dan zona
     * waktu, mis. batas tanggal datang booking (hari ini + 30).
     */
    public static function tambahHari(string $date, int $days): string
    {
        $utc = new DateTimeZone('UTC');

        return (new DateTimeImmutable($date.' 00:00:00', $utc))->modify(sprintf('%+d days', $days))->format('Y-m-d');
    }

    private static function keWib(DateTimeImmutable $time): DateTimeImmutable
    {
        return $time->setTimezone(new DateTimeZone(self::OFFSET));
    }
}
