<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Security;

use App\Support\Time\Time;
use DateTimeImmutable;

/**
 * Aturan hitung pembatas login, tanpa database supaya mudah diuji. Satu nama
 * boleh dicoba 10 kali; percobaan ke-10 masih diperiksa, yang ke-11 ditolak
 * (429) tanpa memeriksa sandi, dan nama itu dikunci 15 menit sejak percobaan
 * ke-10. Percobaan yang berjarak 15 menit atau lebih dari percobaan pertama
 * tidak dihitung bersama-sama.
 *
 * @phpstan-type Catatan array{percobaan: int, mulai: DateTimeImmutable, kunciSampai: DateTimeImmutable|null}
 */
final class AturanBatasMasuk
{
    public const MAKS_PERCOBAAN = 10;

    public const JENDELA_DETIK = 900;

    public const KUNCI_DETIK = 900;

    /**
     * Hasil sisaDetik > 0: ditolak, dan catatan tidak berubah. Hasil sisaDetik
     * = 0: boleh lanjut, dan catatan baru harus disimpan (berubah = true).
     *
     * @param  Catatan|null  $lama  catatan nama itu sekarang; null bila belum ada
     * @return array{catatan: Catatan, sisaDetik: int, berubah: bool}
     */
    public static function terapkan(?array $lama, DateTimeImmutable $sekarang): array
    {
        if ($lama !== null) {
            $kunci = $lama['kunciSampai'];
            if ($kunci !== null && $kunci > $sekarang) {
                return [
                    'catatan' => $lama,
                    'sisaDetik' => self::detikTunggu(Time::millis($kunci) - Time::millis($sekarang)),
                    'berubah' => false,
                ];
            }
            // Kunci sudah lewat, atau percobaan pertama sudah di luar jendela:
            // mulai hitungan baru.
            if ($kunci !== null || Time::millis($sekarang) - Time::millis($lama['mulai']) >= self::JENDELA_DETIK * 1000) {
                $lama = null;
            }
        }
        $catatan = $lama ?? ['percobaan' => 0, 'mulai' => $sekarang, 'kunciSampai' => null];
        $catatan['percobaan']++;
        if ($catatan['percobaan'] >= self::MAKS_PERCOBAAN) {
            $catatan['kunciSampai'] = Time::plusSeconds($sekarang, self::KUNCI_DETIK);
        }

        return ['catatan' => $catatan, 'sisaDetik' => 0, 'berubah' => true];
    }

    /** Membulatkan sisa kunci ke atas menjadi detik utuh untuk header Retry-After (minimal 1). */
    public static function detikTunggu(int $milidetik): int
    {
        return max(1, intdiv($milidetik + 999, 1000));
    }
}
