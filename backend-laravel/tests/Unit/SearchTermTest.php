<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Database\Like;
use App\Support\Database\SearchTerm;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Aturan cocok pencarian (parameter Search di spec): escape LIKE, nama, nomor, nomor HP, dan plat. */
final class SearchTermTest extends TestCase
{
    public function test_like_escapes_backslash_first_then_wildcards(): void
    {
        $this->assertSame('50\\%', Like::escape('50%'));
        $this->assertSame('a\\_b', Like::escape('a_b'));
        // "\" digandakan lebih dulu, supaya "\%" masukan tidak menjadi "\\%" yang
        // justru meng-escape backslash dan membebaskan "%".
        $this->assertSame('c:\\\\x\\%', Like::escape('c:\\x%'));
    }

    public function test_name_term_is_escaped_but_keeps_its_case(): void
    {
        $this->assertSame('Oli 50\\%', SearchTerm::of('Oli 50%')->forName());
    }

    public function test_number_is_uppercased_and_ascii_only(): void
    {
        // s-0001 dan 0001 sama-sama menemukan S-0001; SKU dicocokkan dengan cara yang sama.
        $this->assertSame('S-0001', SearchTerm::of('s-0001')->forNumber());
        $this->assertSame('0001', SearchTerm::of('0001')->forNumber());
        $this->assertSame('OLI\_10W', SearchTerm::of('oli_10w')->forNumber());
        $this->assertNull(SearchTerm::of('Oli Mesin é')->forNumber());
    }

    /** @return array<string, array{string, string|null}> */
    public static function phoneTerms(): array
    {
        return [
            'awalan 0 dengan tanda hubung' => ['0812-34', '6281234'],
            'tanpa awalan' => ['81234', '81234'],
            'awalan +62 dengan spasi' => ['+62 812 34', '6281234'],
            'awalan 62 tetap' => ['62812', '62812'],
            'hanya 0' => ['0', '62'],
            'plus selain +62 tidak pernah cocok' => ['+81234', null],
            'huruf tidak pernah cocok' => ['Budi', null],
            'tanda kurung tidak pernah cocok' => ['(0812)', null],
            'titik tidak pernah cocok' => ['0812.34', null],
        ];
    }

    #[DataProvider('phoneTerms')]
    public function test_phone_term_follows_the_uniform_form(string $term, ?string $expected): void
    {
        $this->assertSame($expected, SearchTerm::of($term)->forPhone());
    }

    /** @return array<string, array{string, string|null}> */
    public static function plateTerms(): array
    {
        return [
            'huruf kecil dan spasi' => ['b 1234', 'B1234'],
            'bagian tengah' => ['1234x', '1234X'],
            'tanda hubung dan titik' => ['b-1234.xyz', 'B1234XYZ'],
            'nama orang juga sah sebagai plat' => ['Budi', 'BUDI'],
            'spasi di tengah nama tetap dibuang' => ['Budi Santoso', 'BUDISANTOSO'],
            'huruf non-ASCII tidak pernah cocok' => ['José', null],
            'garis miring tidak pernah cocok' => ['B/1234', null],
            'hanya tanda baca tidak pernah cocok' => ['- .', null],
        ];
    }

    #[DataProvider('plateTerms')]
    public function test_plate_term_is_compacted_and_uppercased(string $term, ?string $expected): void
    {
        $this->assertSame($expected, SearchTerm::of($term)->forPlate());
    }

    public function test_invalid_utf8_never_matches(): void
    {
        $this->assertTrue(SearchTerm::of("Bu\xFFdi")->neverMatches());
        $this->assertFalse(SearchTerm::of('Budi')->neverMatches());
    }

    public function test_empty_term_means_no_filter(): void
    {
        $this->assertTrue(SearchTerm::of('')->isEmpty());
        $this->assertFalse(SearchTerm::of('oli')->isEmpty());
    }
}
