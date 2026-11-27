<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Validation;

use App\Support\Text\Text;

/**
 * Nomor HP Indonesia seperti diketik pengguna → bentuk seragam 628….
 *
 * Kasir dan pelanggan mengetik nomor dengan berbagai cara (0812-3456-7890,
 * +62 812 3456 7890, 6281234567890). Semuanya disimpan dalam satu bentuk,
 * karena nomor ini dikirimi WhatsApp dan dicari kasir: bentuk yang
 * berbeda-beda membuat pencarian meleset dan penyedia WhatsApp menolak.
 *
 * Urutan pemeriksaannya sengaja berbeda dari prioritas umum kode field
 * (format dinilai sebelum panjang), karena panjang baru bisa dihitung setelah
 * awalannya dikenali.
 */
final class PhoneNumber
{
    public const MIN_DIGITS = 10;

    public const MAX_DIGITS = 15;

    /** Awalan yang diterima: +62, 62, atau 0, lalu wajib angka 8 (nomor seluler). */
    private const INPUT = '/^(\+62|62|0)8[0-9]*$/D';

    /**
     * @return array{0: string, 1: string} bentuk seragam (atau "" bila gagal)
     *                                     dan kode aturan yang dilanggar ("" bila sah)
     */
    public static function normalize(string $input): array
    {
        // Pangkas ujungnya, lalu buang spasi dan tanda hubung di mana pun.
        // Tab atau baris baru di tengah nomor tidak dibuang, jadi tetap
        // invalid_format.
        $compact = str_replace([' ', '-'], '', Text::trim($input));
        if ($compact === '') {
            return ['', FieldCode::REQUIRED];
        }
        if (preg_match(self::INPUT, $compact, $match) !== 1) {
            return ['', FieldCode::INVALID_FORMAT];
        }
        $normalized = '62'.substr($compact, strlen($match[1]));
        if (strlen($normalized) < self::MIN_DIGITS) {
            return ['', FieldCode::TOO_SHORT];
        }
        if (strlen($normalized) > self::MAX_DIGITS) {
            return ['', FieldCode::TOO_LONG];
        }

        return [$normalized, ''];
    }

    /**
     * Samaran nomor seragam untuk respons publik (NomorHpSamaran): 4 digit
     * pertama, tepat empat "*", lalu 4 digit terakhir, apa pun panjang
     * nomornya. 6281234567890 → 6281****7890; 6281234567 → 6281****4567.
     *
     * Halaman booking dan lacak servis bisa dibuka siapa saja yang memegang
     * tautannya, jadi nomor utuh tidak pernah dikirim ke sana; empat digit
     * terakhir cukup bagi pelanggan untuk mengenali nomornya sendiri. Jumlah
     * bintang dibuat tetap supaya panjang nomor pun tidak terbaca.
     */
    public static function mask(string $normalized): string
    {
        return substr($normalized, 0, 4).'****'.substr($normalized, -4);
    }
}
