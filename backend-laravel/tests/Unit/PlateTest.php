<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Validation\Plate;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Plat nomor: kunci untuk keunikan dan pencarian, tampilan yang dirapikan (skema PlatMasukan). */
final class PlateTest extends TestCase
{
    /**
     * Contoh sah, delapan pertama persis dari tabel di skema PlatMasukan.
     *
     * @return array<string, array{string, string, string}>
     */
    public static function validPlates(): array
    {
        return [
            'contoh spec huruf kecil' => ['b1234xyz', 'B1234XYZ', 'B 1234 XYZ'],
            'contoh spec spasi ganda di tengah dan tepi' => [' B 1234  XYZ ', 'B1234XYZ', 'B 1234 XYZ'],
            'contoh spec tanda hubung' => ['B-1234-XYZ', 'B1234XYZ', 'B 1234 XYZ'],
            'contoh spec dua huruf depan' => ['ab 12 c', 'AB12C', 'AB 12 C'],
            'contoh spec tanpa huruf belakang' => ['D 1', 'D1', 'D 1'],
            'contoh spec huruf rapat' => ['RI1', 'RI1', 'RI 1'],
            'contoh spec angka lagi di belakang' => ['B 1234 XYZ 5', 'B1234XYZ5', 'B1234XYZ5'],
            'contoh spec tanpa angka' => ['ABCDE', 'ABCDE', 'ABCDE'],
            'titik dibuang' => ['B.1234.XYZ', 'B1234XYZ', 'B 1234 XYZ'],
            'tab dan baris baru di tepi dipangkas' => ["\tb 1234 xyz\r\n", 'B1234XYZ', 'B 1234 XYZ'],
            'paling pendek, 2 karakter' => ['B1', 'B1', 'B 1'],
            'paling panjang, 12 karakter' => ['ABC 123456 XYZ', 'ABC123456XYZ', 'ABC 123456 XYZ'],
            'huruf, angka, huruf, angka' => ['B12C3', 'B12C3', 'B12C3'],
        ];
    }

    #[DataProvider('validPlates')]
    public function test_valid_plate_gets_key_and_display(string $input, string $key, string $display): void
    {
        [$plate, $code] = Plate::normalize($input);

        $this->assertSame('', $code);
        $this->assertSame($key, $plate?->key);
        $this->assertSame($display, $plate?->display);
        // Menghapus spasi tampilan selalu menghasilkan kunci (CHECK vehicles_plate_sesuai_kunci).
        $this->assertSame($key, str_replace(' ', '', (string) $plate?->display));
        $this->assertMatchesRegularExpression('/^[A-Z][A-Z0-9]*( [A-Z0-9]+){0,2}$/D', (string) $plate?->display);
        $this->assertLessThanOrEqual(14, strlen((string) $plate?->display));
    }

    /**
     * Contoh salah, empat pertama persis dari tabel di skema PlatMasukan.
     *
     * @return array<string, array{string, string}>
     */
    public static function invalidPlates(): array
    {
        return [
            'contoh spec diawali angka' => ['1234 AB', 'invalid_format'],
            'contoh spec satu huruf' => ['B', 'too_short'],
            'contoh spec 13 karakter' => ['B 1234 ABCDEFGH', 'too_long'],
            'contoh spec garis miring' => ['B/1234', 'invalid_format'],
            'kosong' => ['', 'required'],
            'hanya spasi' => ['   ', 'required'],
            'hanya tanda hubung dan titik' => [' - . ', 'required'],
            'tab di tengah' => ["B\t1234", 'invalid_format'],
            'huruf non-ASCII' => ['B 1234 ÄB', 'invalid_format'],
            'huruf besar lebar penuh' => ['Ｂ1234', 'invalid_format'],
            'garis bawah' => ['B_1234', 'invalid_format'],
            'format dinilai sebelum panjang' => ['1', 'invalid_format'],
            'panjang dan format salah sekaligus: format menang' => ['B/1234567890123', 'invalid_format'],
            'baris baru di tengah' => ["B\n1234", 'invalid_format'],
        ];
    }

    #[DataProvider('invalidPlates')]
    public function test_invalid_plate_gets_one_field_code(string $input, string $code): void
    {
        $this->assertSame([null, $code], Plate::normalize($input));
    }

    public function test_display_is_derived_from_the_key_alone(): void
    {
        $this->assertSame('B 1234 XYZ', Plate::display('B1234XYZ'));
        $this->assertSame('B 1234', Plate::display('B1234'));
        $this->assertSame('B1234XYZ5', Plate::display('B1234XYZ5'));
    }

    /** @return array<string, array{string, string, string}> */
    public static function plateQueries(): array
    {
        return [
            'bagian depan huruf kecil' => ['b1234', 'B1234', ''],
            'boleh diawali angka' => ['1234', '1234', ''],
            'spasi dan tanda hubung dibuang' => [' 12-34 x ', '1234X', ''],
            'satu karakter sah' => ['x', 'X', ''],
            'kosong' => ['', '', 'required'],
            'kosong sesudah dinormalkan' => [' -.', '', 'required'],
            'garis miring' => ['B/12', '', 'invalid_format'],
            'huruf non-ASCII' => ['é', '', 'invalid_format'],
            '13 karakter' => ['ABCDEFGHIJKLM', '', 'too_long'],
            '12 karakter' => ['ABCDEFGHIJKL', 'ABCDEFGHIJKL', ''],
        ];
    }

    /** Parameter ?plate= di GET /api/vehicles (PlateQuery). */
    #[DataProvider('plateQueries')]
    public function test_plate_query(string $input, string $term, string $code): void
    {
        $this->assertSame([$term, $code], Plate::query($input));
    }
}
