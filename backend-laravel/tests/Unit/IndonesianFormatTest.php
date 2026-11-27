<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Format\IndonesianFormat;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Format rupiah dan bilangan untuk teks pesan WhatsApp (spec/whatsapp.md bagian 4). */
final class IndonesianFormatTest extends TestCase
{
    /** @return array<string, array{int, string}> */
    public static function rupiahCases(): array
    {
        return [
            // Enam contoh pertama persis dari tabel "Format nilai" di spec.
            'contoh spec nol' => [0, 'Rp0'],
            'contoh spec satuan' => [7, 'Rp7'],
            'contoh spec ratusan' => [500, 'Rp500'],
            'contoh spec puluhan ribu' => [35_000, 'Rp35.000'],
            'contoh spec ratusan ribu' => [150_000, 'Rp150.000'],
            'contoh spec jutaan' => [1_250_000, 'Rp1.250.000'],
            'tepat seribu' => [1_000, 'Rp1.000'],
            'total contoh nota' => [165_000, 'Rp165.000'],
            'harga item tertinggi' => [100_000_000, 'Rp100.000.000'],
            '50 item x 99 x harga tertinggi' => [495_000_000_000, 'Rp495.000.000.000'],
            'terbesar yang bisa disimpan' => [PHP_INT_MAX, 'Rp9.223.372.036.854.775.807'],
            'negatif diberi tanda minus' => [-12_500, '-Rp12.500'],
            'negatif terkecil tidak meluap' => [PHP_INT_MIN, '-Rp9.223.372.036.854.775.808'],
        ];
    }

    #[DataProvider('rupiahCases')]
    public function test_rupiah_uses_dot_thousands_separator_without_space(int $amount, string $expected): void
    {
        $this->assertSame($expected, IndonesianFormat::rupiah($amount));
    }

    /** @return array<string, array{int, string}> */
    public static function numberCases(): array
    {
        return [
            'nol' => [0, '0'],
            'satuan' => [3, '3'],
            'ratusan' => [999, '999'],
            'ribuan' => [1_500, '1.500'],
            'ratusan ribu' => [100_000, '100.000'],
            'negatif' => [-1_500, '-1.500'],
        ];
    }

    #[DataProvider('numberCases')]
    public function test_number_uses_dot_every_three_digits(int $value, string $expected): void
    {
        $this->assertSame($expected, IndonesianFormat::number($value));
    }
}
