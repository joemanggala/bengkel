<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Jasa\Requests\JasaInput;
use App\Modules\Sparepart\Requests\SparepartInput;
use App\Modules\Sparepart\Sparepart;
use App\Support\Validation\JsonObject;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Aturan badan sparepart dan jasa yang ditulis sendiri di modulnya: SKU
 * dibesarkan sebelum polanya dinilai, PATCH hanya memuat field yang dikirim
 * (termasuk durasi null), dan bentuk sparepart tanpa harga beli untuk kasir.
 */
final class SparepartJasaInputTest extends TestCase
{
    /** @return array<string, array{string, string|null, string}> */
    public static function skuCases(): array
    {
        return [
            'dipangkas dan dibesarkan' => ['"  oli-10w40.a/b_c \t"', 'OLI-10W40.A/B_C', ''],
            'kosong' => ['"   "', null, 'required'],
            'null' => ['null', null, 'required'],
            'angka' => ['5', null, 'invalid_type'],
            'panjang dinilai sebelum format' => ['"A B'.str_repeat('C', 38).'"', null, 'too_long'],
            'tepat 40' => ['"'.str_repeat('a', 40).'"', str_repeat('A', 40), ''],
            'spasi di tengah' => ['"OLI 10"', null, 'invalid_format'],
            'diawali tanda hubung' => ['"-OLI"', null, 'invalid_format'],
            'huruf non-ASCII tidak dibesarkan' => ['"éoli"', null, 'invalid_format'],
        ];
    }

    #[DataProvider('skuCases')]
    public function test_sku_is_uppercased_before_its_pattern_is_checked(string $json, ?string $expected, string $code): void
    {
        $body = JsonObject::parse('{"sku":'.$json.'}');
        $changes = SparepartInput::ubah($body);

        $this->assertSame($code === '' ? [] : ['sku' => $code], $body->errors()->all());
        if ($expected !== null) {
            $this->assertSame($expected, $changes['sku']);
        }
    }

    public function test_part_patch_contains_only_sent_fields_and_never_stock(): void
    {
        $body = JsonObject::parse('{"price":57000,"stock":999,"initialStock":5,"isActive":false}');

        $this->assertSame(['price' => 57000, 'is_active' => false], SparepartInput::ubah($body));
        $this->assertTrue($body->errors()->isEmpty());
    }

    public function test_part_create_defaults_and_null_rules(): void
    {
        $ok = JsonObject::parse('{"sku":"a1","name":"Busi","unit":"pcs","price":1.5e4}');
        $this->assertSame(
            ['sku' => 'A1', 'name' => 'Busi', 'unit' => 'pcs', 'price' => 15000, 'cost_price' => 0, 'min_stock' => 0],
            SparepartInput::buat($ok),
        );
        $this->assertSame(0, SparepartInput::initialStock($ok));

        $bad = JsonObject::parse('{"price":null,"costPrice":null,"minStock":null,"initialStock":null}');
        SparepartInput::buat($bad);
        SparepartInput::initialStock($bad);
        $this->assertSame([
            'sku' => 'required', 'name' => 'required', 'unit' => 'required', 'price' => 'required',
            'costPrice' => 'invalid_type', 'minStock' => 'invalid_type', 'initialStock' => 'invalid_type',
        ], $bad->errors()->all());
    }

    public function test_service_patch_keeps_null_duration_as_a_change(): void
    {
        $body = JsonObject::parse('{"durationMinutes":null}');

        $this->assertSame(['duration_minutes' => null], JasaInput::ubah($body));
        $this->assertSame([], JasaInput::ubah(JsonObject::parse('{"lain":1}')));
    }

    public function test_service_null_rules_differ_between_required_and_optional_fields(): void
    {
        $body = JsonObject::parse('{"name":null,"price":null,"description":null,"durationMinutes":null,"isPublic":null,"isActive":null,"sortOrder":null}');
        JasaInput::buat($body);

        $this->assertSame([
            'name' => 'required', 'description' => 'invalid_type', 'price' => 'required',
            'isPublic' => 'invalid_type', 'isActive' => 'invalid_type', 'sortOrder' => 'invalid_type',
        ], $body->errors()->all());
    }

    public function test_cost_price_key_is_absent_for_non_owners(): void
    {
        $part = new Sparepart('p', 'SKU', 'Busi', 'pcs', 20000, 15000, 3, 3, true, '2026-01-01 00:00:00.000', '2026-01-01 00:00:00.000');

        $this->assertArrayNotHasKey('costPrice', $part->toArray(false));
        $this->assertSame(15000, $part->toArray(true)['costPrice']);
        $this->assertSame('low', $part->toArray(false)['stockLevel']);
        $this->assertSame(array_keys($part->toArray(false)), array_values(array_diff(array_keys($part->toArray(true)), ['costPrice'])));
    }
}
