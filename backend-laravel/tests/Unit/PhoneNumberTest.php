<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Validation\JsonObject;
use App\Support\Validation\PhoneNumber;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Nomor HP seperti diketik kasir → bentuk seragam 628…, 10 sampai 15 digit. */
final class PhoneNumberTest extends TestCase
{
    /** @return array<string, array{string, string}> */
    public static function validNumbers(): array
    {
        return [
            'awalan 0 dengan tanda hubung' => ['0812-3456-7890', '6281234567890'],
            'awalan +62 dengan spasi' => ['+62 812 3456 7890', '6281234567890'],
            'sudah seragam' => ['6281234567890', '6281234567890'],
            'dipangkas di ujung' => [" \t081234567890\r\n", '6281234567890'],
            'spasi dan tanda hubung bertubi-tubi' => ['0812 - 3456 -- 7890', '6281234567890'],
            'paling pendek, 10 digit' => ['081234567', '6281234567'],
            '14 digit dari +62' => ['+62812345678901', '62812345678901'],
            'paling panjang, 15 digit' => ['08123456789012', '628123456789012'],
            '15 digit dari 62' => ['628123456789012', '628123456789012'],
        ];
    }

    #[DataProvider('validNumbers')]
    public function test_valid_number_is_normalized(string $input, string $expected): void
    {
        $this->assertSame([$expected, ''], PhoneNumber::normalize($input));
    }

    /** @return array<string, array{string, string}> */
    public static function invalidNumbers(): array
    {
        return [
            'kosong' => ['', 'required'],
            'hanya spasi' => ['   ', 'required'],
            'hanya spasi dan tanda hubung' => [' - - ', 'required'],
            'huruf' => ['0812abcd', 'invalid_format'],
            'tanda kurung' => ['(0812) 3456 7890', 'invalid_format'],
            '+08' => ['+081234567890', 'invalid_format'],
            '6208' => ['62081234567890', 'invalid_format'],
            'bukan seluler (021)' => ['0215551234', 'invalid_format'],
            'nomor luar negeri' => ['+6591234567', 'invalid_format'],
            'tab di tengah' => ["0812\t34567890", 'invalid_format'],
            'titik' => ['0812.3456.7890', 'invalid_format'],
            'angka non-ASCII' => ['٠٨١٢٣٤٥٦٧٨٩٠', 'invalid_format'],
            'format dinilai sebelum panjang' => ['08x', 'invalid_format'],
            '9 digit' => ['08123456', 'too_short'],
            'hanya awalan' => ['08', 'too_short'],
            '16 digit' => ['081234567890123', 'too_long'],
            // Empat baris salah di tabel skema NomorHpMasukan, persis.
            'contoh spec terlalu pendek' => ['08123456', 'too_short'],
            'contoh spec 17 digit' => ['0812345678901234', 'too_long'],
            'contoh spec telepon rumah' => ['021-555-1234', 'invalid_format'],
            'contoh spec tanda kurung' => ['(0812) 3456', 'invalid_format'],
        ];
    }

    #[DataProvider('invalidNumbers')]
    public function test_invalid_number_gets_one_field_code(string $input, string $code): void
    {
        $this->assertSame(['', $code], PhoneNumber::normalize($input));
    }

    /**
     * Contoh spec: tiga pertama persis dari skema NomorHpSamaran.
     *
     * @return array<string, array{string, string}>
     */
    public static function maskedNumbers(): array
    {
        return [
            'contoh spec 13 digit' => ['6281234567890', '6281****7890'],
            'contoh spec 10 digit' => ['6281234567', '6281****4567'],
            'contoh spec 15 digit' => ['628123456789012', '6281****9012'],
            '12 digit' => ['628123456789', '6281****6789'],
        ];
    }

    #[DataProvider('maskedNumbers')]
    public function test_mask_keeps_first_and_last_four_digits_with_exactly_four_stars(string $phone, string $expected): void
    {
        $masked = PhoneNumber::mask($phone);

        $this->assertSame($expected, $masked);
        $this->assertMatchesRegularExpression('/^628[0-9][*]{4}[0-9]{4}$/D', $masked);
    }

    public function test_json_field_checks_type_before_number_rules(): void
    {
        $body = JsonObject::parse('{"a":"0812-3456-7890","b":81234567890,"c":null,"e":"08"}');

        $this->assertSame('6281234567890', $body->phone('a'));
        $this->assertSame('', $body->phone('b'));
        $this->assertSame('', $body->phone('c'));
        $this->assertSame('', $body->phone('d'));
        $this->assertSame('', $body->phone('e'));
        $this->assertSame(
            ['b' => 'invalid_type', 'c' => 'required', 'd' => 'required', 'e' => 'too_short'],
            $body->errors()->all(),
        );
    }
}
