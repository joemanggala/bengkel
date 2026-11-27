<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Format;

/**
 * Format angka untuk teks yang dibaca manusia (pesan WhatsApp, spec/whatsapp.md
 * bagian 4): rupiah dan bilangan berpemisah ribuan. Format tanggal dan waktu
 * WIB ada di App\Support\Time\Wib.
 *
 * Fungsi locale bawaan (NumberFormatter, setlocale) sengaja tidak dipakai:
 * hasilnya bergantung pada data ICU dan locale server, sehingga backend Go,
 * Laravel, dan NestJS bisa menghasilkan teks yang berbeda (mis. spasi tak
 * terputus sesudah "Rp"). number_format() PHP juga tidak dipakai karena
 * menerima float, yang kehilangan ketepatan di atas 2^53. Di sini semuanya
 * disusun dari digit bilangan bulat dengan aturan yang sama persis di ketiga
 * bahasa.
 */
final class IndonesianFormat
{
    /** Bilangan bulat dengan titik setiap tiga digit dari kanan: 1.500, 100.000. */
    public static function number(int $value): string
    {
        // Diambil dari teksnya, bukan dengan abs(): PHP_INT_MIN tidak punya
        // pasangan positif dalam int dan akan berubah menjadi float.
        $digits = (string) $value;
        $sign = '';
        if ($value < 0) {
            $sign = '-';
            $digits = substr($digits, 1);
        }

        return $sign.strrev(implode('.', str_split(strrev($digits), 3)));
    }

    /**
     * rupiah(x) di spec: "Rp" + angka bulat dengan titik setiap tiga digit
     * dari kanan, tanpa spasi: Rp0, Rp35.000, Rp1.250.000. Uang di kontrak
     * tidak pernah negatif; tanda minus tetap ditulis di depan "Rp" supaya
     * kesalahan hitung terlihat jelas, bukan tersamar.
     */
    public static function rupiah(int $amount): string
    {
        $text = self::number($amount);

        return $amount < 0 ? '-Rp'.substr($text, 1) : 'Rp'.$text;
    }
}
