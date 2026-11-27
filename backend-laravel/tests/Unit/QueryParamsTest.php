<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Http\Page;
use App\Support\Http\QueryParams;
use App\Support\Validation\FieldErrors;
use PHPUnit\Framework\TestCase;

/**
 * Pembacaan query mentah. Yang ditegaskan di sini adalah titik koma: pemisah
 * parameter hanya "&", dan ";" adalah data biasa (spek, bagian Format).
 * Pengurai query bawaan Go membuang pasangan ber-";" diam-diam, dan PHP
 * (parse_str) bisa dikonfigurasi memakainya sebagai pemisah; keduanya
 * membuat filter hilang tanpa kabar.
 */
final class QueryParamsTest extends TestCase
{
    public function test_a_semicolon_is_part_of_the_value_not_a_separator(): void
    {
        $query = QueryParams::parse('search=a;b&limit=1;page=2');

        $this->assertSame('a;b', $query->get('search'));
        $this->assertSame('1;page=2', $query->get('limit'));
        $this->assertFalse($query->has('page'), '"page=2" setelah ";" bukan parameter sendiri');
    }

    public function test_an_encoded_semicolon_reads_the_same_as_a_raw_one(): void
    {
        $this->assertSame(
            QueryParams::parse('search=Rina;abc')->get('search'),
            QueryParams::parse('search=Rina%3Babc')->get('search'),
        );
        $this->assertSame('Rina;abc', QueryParams::parse('search=Rina%3Babc')->search());
    }

    public function test_a_semicolon_in_a_name_or_at_the_edges_is_kept_as_is(): void
    {
        $query = QueryParams::parse(';a=1&b=;&c=;;;&d;e=2');

        $this->assertSame('1', $query->get(';a'));
        $this->assertSame(';', $query->get('b'));
        $this->assertSame(';;;', $query->get('c'));
        $this->assertSame('2', $query->get('d;e'));
    }

    public function test_only_empty_pairs_are_skipped(): void
    {
        $query = QueryParams::parse('&&a=1&&b=2&');

        $this->assertTrue($query->has('a'));
        $this->assertTrue($query->has('b'));
        $this->assertFalse($query->has(''));
    }

    public function test_limit_with_a_semicolon_is_422_invalid_format_not_two_parameters(): void
    {
        $errors = new FieldErrors;

        Page::parse(QueryParams::parse('limit=1;page=2'), $errors);

        $this->assertSame(['limit' => 'invalid_format'], $errors->all());
    }

    public function test_search_keeps_the_text_after_the_semicolon(): void
    {
        $this->assertSame('Rina;abc', QueryParams::parse('search=Rina;abc')->search());
        $this->assertSame('QUEUED;x', QueryParams::parse('status=QUEUED;x')->get('status'));
    }

    public function test_boolean_filter_accepts_only_lowercase_true_or_false(): void
    {
        $errors = new FieldErrors;
        $query = QueryParams::parse('a=true&b=false&c=TRUE&d=&e=1&f=true;x');

        $this->assertTrue($query->boolean('a', $errors));
        $this->assertFalse($query->boolean('b', $errors));
        $this->assertNull($query->boolean('tidak-dikirim', $errors), 'tidak dikirim = tidak menyaring');
        $this->assertTrue($errors->isEmpty());

        foreach (['c', 'd', 'e', 'f'] as $nama) {
            $this->assertNull($query->boolean($nama, $errors));
        }
        $this->assertSame(['c' => 'invalid_format', 'd' => 'invalid_format', 'e' => 'invalid_format', 'f' => 'invalid_format'], $errors->all());
    }
}
