<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Validation;

use App\Support\Text\Text;

/**
 * Plat nomor kendaraan: kunci untuk keunikan dan pencarian, dan tampilan
 * yang dirapikan (spec, skema PlatMasukan, PlatKunci, PlatTampilan).
 *
 * Kasir dan pelanggan mengetik plat dengan berbagai cara ("b 1234-xyz",
 * "B1234XYZ", " B 1234  XYZ "). Tanpa satu bentuk baku, satu motor bisa
 * tercatat dua kali dan pencarian meleset. Karena itu:
 *
 *  - kunci = huruf besar tanpa spasi, tanda hubung, dan titik ("B1234XYZ"),
 *    dipakai untuk indeks unik vehicles.plate_key dan pencarian;
 *  - tampilan = kelompok huruf depan, angka, dan huruf belakang dipisah satu
 *    spasi ("B 1234 XYZ"), atau kunci apa adanya bila tidak mengikuti pola
 *    itu (keputusan 0a-12), supaya ketiga backend menghasilkan bentuk yang
 *    sama persis tanpa menyimpan spasi ketikan.
 *
 * Menghapus semua spasi dari tampilan selalu menghasilkan kunci (dijaga juga
 * oleh CHECK vehicles_plate_sesuai_kunci di database).
 */
final readonly class Plate
{
    public const MIN_LENGTH = 2;

    public const MAX_LENGTH = 12;

    /** Kunci yang sah: diawali huruf, lalu huruf besar atau angka. */
    private const KEY = '/^[A-Z][A-Z0-9]*$/D';

    /** Pola tampilan: huruf depan, angka, huruf belakang (boleh kosong). */
    private const GROUPS = '/^([A-Z]+)([0-9]+)([A-Z]*)$/D';

    private function __construct(
        public string $key,
        public string $display,
    ) {}

    /**
     * Plat seperti diketik → kunci dan tampilan. Urutan pemeriksaannya sesuai
     * spec (format dinilai sebelum panjang, sama seperti nomor HP):
     *
     *  1. pangkas spasi, tab, CR, LF di tepi; buang semua spasi, "-", dan ".";
     *     besarkan a-z (huruf lain tidak disentuh). Kosong → required;
     *  2. ada karakter selain A-Z dan 0-9 (huruf non-ASCII, tab di tengah,
     *     garis miring), atau tidak diawali huruf → invalid_format;
     *  3. kurang dari 2 karakter → too_short; lebih dari 12 → too_long.
     *
     * @return array{0: self|null, 1: string} plat (null bila gagal) dan kode aturan ("" bila sah)
     */
    public static function normalize(string $input): array
    {
        $key = self::compact($input);
        if ($key === '') {
            return [null, FieldCode::REQUIRED];
        }
        if (preg_match(self::KEY, $key) !== 1) {
            return [null, FieldCode::INVALID_FORMAT];
        }
        if (strlen($key) < self::MIN_LENGTH) {
            return [null, FieldCode::TOO_SHORT];
        }
        if (strlen($key) > self::MAX_LENGTH) {
            return [null, FieldCode::TOO_LONG];
        }

        return [new self($key, self::display($key)), ''];
    }

    /**
     * Parameter ?plate= di GET /api/vehicles: bagian plat yang dicari, jadi
     * boleh diawali angka ("1234" mencari bagian tengah). Kosong sesudah
     * dinormalkan → required; karakter selain A-Z dan 0-9 → invalid_format;
     * lebih dari 12 karakter → too_long. Format dinilai sebelum panjang,
     * sama dengan normalize().
     *
     * @return array{0: string, 1: string} bagian kunci yang dicari dan kode aturan ("" bila sah)
     */
    public static function query(string $input): array
    {
        $term = self::compact($input);
        if ($term === '') {
            return ['', FieldCode::REQUIRED];
        }
        if (preg_match('/^[A-Z0-9]+$/D', $term) !== 1) {
            return ['', FieldCode::INVALID_FORMAT];
        }
        if (strlen($term) > self::MAX_LENGTH) {
            return ['', FieldCode::TOO_LONG];
        }

        return [$term, ''];
    }

    /**
     * Tampilan dari kunci yang sudah sah: kelompok yang tidak kosong dari
     * pola huruf-angka-huruf digabung satu spasi, selain itu kunci apa adanya.
     * "B1234XYZ" → "B 1234 XYZ", "D1" → "D 1", "B1234XYZ5" → "B1234XYZ5".
     */
    public static function display(string $key): string
    {
        if (preg_match(self::GROUPS, $key, $m) !== 1) {
            return $key;
        }

        return implode(' ', array_filter([$m[1], $m[2], $m[3]], fn (string $part): bool => $part !== ''));
    }

    /**
     * Langkah normalisasi yang dipakai bersama masukan plat, parameter
     * ?plate=, dan ?search=: pangkas tepi, buang spasi (U+0020), "-", dan ".",
     * lalu besarkan a-z. Tab di tengah dan huruf non-ASCII dibiarkan supaya
     * tetap ditolak pemeriksa sesudahnya.
     */
    public static function compact(string $input): string
    {
        return Text::upperAscii(str_replace([' ', '-', '.'], '', Text::trim($input)));
    }
}
