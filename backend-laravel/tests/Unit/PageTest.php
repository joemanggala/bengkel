<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Http\ApiError;
use App\Support\Http\Page;
use App\Support\Http\QueryParams;
use App\Support\Validation\FieldErrors;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Paginasi ?page=&limit= dan pembacaan query mentah. */
final class PageTest extends TestCase
{
    public function test_defaults_when_not_sent(): void
    {
        $page = Page::fromQuery(QueryParams::parse(''));

        $this->assertSame(1, $page->page);
        $this->assertSame(20, $page->limit);
        $this->assertSame(0, $page->offset());
        $this->assertSame(['page' => 1, 'limit' => 20, 'total' => 7], $page->meta(7));
    }

    public function test_offset_and_leading_zeros(): void
    {
        $page = Page::fromQuery(QueryParams::parse('page=003&limit=50'));

        $this->assertSame(3, $page->page);
        $this->assertSame(50, $page->limit);
        $this->assertSame(100, $page->offset());
    }

    /** @return array<string, array{string, array<string, string>}> */
    public static function invalidQueries(): array
    {
        return [
            'kosong' => ['page=', ['page' => 'invalid_format']],
            'huruf' => ['page=abc', ['page' => 'invalid_format']],
            'negatif' => ['page=-1', ['page' => 'invalid_format']],
            'pecahan' => ['limit=1.5', ['limit' => 'invalid_format']],
            'tanda plus' => ['limit=%2B1', ['limit' => 'invalid_format']],
            'nol' => ['page=0', ['page' => 'out_of_range']],
            'di atas sejuta' => ['page=1000001', ['page' => 'out_of_range']],
            'angka raksasa tidak meluap' => ['page=99999999999999999999999', ['page' => 'out_of_range']],
            'limit di atas 50' => ['limit=51', ['limit' => 'out_of_range']],
            'keduanya dilaporkan' => ['page=x&limit=0', ['page' => 'invalid_format', 'limit' => 'out_of_range']],
        ];
    }

    /** @param  array<string, string>  $fields */
    #[DataProvider('invalidQueries')]
    public function test_invalid_values_are_422_never_clamped(string $query, array $fields): void
    {
        try {
            Page::fromQuery(QueryParams::parse($query));
            $this->fail('seharusnya 422');
        } catch (ApiError $e) {
            $this->assertSame(422, $e->status);
            $this->assertSame($fields, $e->fields);
        }
    }

    public function test_errors_can_be_collected_with_other_parameters(): void
    {
        $errors = new FieldErrors;
        $errors->add('status', 'invalid_format');
        Page::parse(QueryParams::parse('limit=0'), $errors);

        $this->assertSame(['status' => 'invalid_format', 'limit' => 'out_of_range'], $errors->all());
    }

    public function test_query_takes_first_occurrence_and_keeps_names_raw(): void
    {
        $query = QueryParams::parse('search=%20budi+santoso%09&search=lain&a.b=1&c[]=2&rusak=%zz&kosong=');

        $this->assertSame('budi santoso', $query->search());
        $this->assertSame('1', $query->get('a.b'));
        $this->assertSame('2', $query->get('c[]'));
        $this->assertFalse($query->has('rusak'));
        $this->assertTrue($query->has('kosong'));
        $this->assertSame('', $query->get('kosong'));
        $this->assertFalse($query->has('tidak-ada'));
    }
}
