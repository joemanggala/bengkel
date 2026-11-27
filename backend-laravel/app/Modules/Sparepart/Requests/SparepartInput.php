<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sparepart\Requests;

use App\Support\Text\Text;
use App\Support\Validation\FieldCode;
use App\Support\Validation\IntRule;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;

/**
 * Aturan field sparepart (BuatSparepartRequest dan UbahSparepartRequest).
 * Hasilnya berupa kolom tabel parts. Stok tidak pernah termasuk: stok hanya
 * berubah lewat kartu stok, jadi field stock di badan diabaikan seperti field
 * lain yang tidak dikenal.
 */
final class SparepartInput
{
    public const MAX_AMOUNT = 100_000_000;

    /**
     * Pola SKU dinilai sesudah huruf a-z dibesarkan. Huruf non-ASCII tidak
     * dibesarkan, jadi "éOLI" tetap tidak cocok (invalid_format).
     */
    private const SKU_PATTERN = '/^[A-Z0-9][A-Z0-9._\/-]*$/D';

    /**
     * Badan POST /api/parts. Wajib: sku, name, unit, price. Opsional:
     * costPrice dan minStock (bawaan 0; null → invalid_type). Sparepart baru
     * selalu aktif, jadi isActive di badan diabaikan.
     *
     * @return array<string, mixed>
     */
    public static function buat(JsonObject $body): array
    {
        return [
            'sku' => self::sku($body),
            'name' => self::name($body),
            'unit' => self::unit($body),
            'price' => self::price($body),
            'cost_price' => self::costPrice($body),
            'min_stock' => self::minStock($body),
        ];
    }

    /** initialStock opsional, bawaan 0; null → invalid_type. */
    public static function initialStock(JsonObject $body): int
    {
        return $body->int('initialStock', new IntRule(0, self::MAX_AMOUNT, optional: true));
    }

    /**
     * Badan PATCH: hanya field yang dikirim. null pada sku, name, unit, price
     * → required; null pada costPrice, minStock, isActive → invalid_type.
     *
     * @return array<string, mixed> kolom → nilai baru (hanya yang dikirim)
     */
    public static function ubah(JsonObject $body): array
    {
        $changes = [];
        if ($body->has('sku')) {
            $changes['sku'] = self::sku($body);
        }
        if ($body->has('name')) {
            $changes['name'] = self::name($body);
        }
        if ($body->has('unit')) {
            $changes['unit'] = self::unit($body);
        }
        if ($body->has('price')) {
            $changes['price'] = self::price($body);
        }
        if ($body->has('costPrice')) {
            $changes['cost_price'] = self::costPrice($body);
        }
        if ($body->has('minStock')) {
            $changes['min_stock'] = self::minStock($body);
        }
        if ($body->has('isActive')) {
            $changes['is_active'] = $body->bool('isActive', optional: true);
        }

        return $changes;
    }

    /**
     * Harga beli (HargaBeliSparepart), dipakai juga oleh stok masuk:
     * opsional, null → invalid_type, 0..100.000.000.
     */
    public static function costPrice(JsonObject $body): int
    {
        return $body->int('costPrice', new IntRule(0, self::MAX_AMOUNT, optional: true));
    }

    /**
     * Dipangkas, panjang dinilai lebih dulu (lebih dari 40 → too_long walau
     * berspasi), lalu a-z dibesarkan dan baru polanya dinilai. Karena
     * dibesarkan, "oli-10w40" dan "OLI-10W40" adalah SKU yang sama.
     */
    private static function sku(JsonObject $body): string
    {
        $sku = $body->text('sku', new TextRule(trim: true, max: 40));
        if ($body->failed('sku')) {
            return '';
        }
        $sku = Text::upperAscii($sku);
        if (preg_match(self::SKU_PATTERN, $sku) !== 1) {
            $body->fail('sku', FieldCode::INVALID_FORMAT);

            return '';
        }

        return $sku;
    }

    private static function name(JsonObject $body): string
    {
        return $body->text('name', new TextRule(trim: true, min: 2, max: 100));
    }

    private static function unit(JsonObject $body): string
    {
        return $body->text('unit', new TextRule(trim: true, max: 20));
    }

    private static function price(JsonObject $body): int
    {
        return $body->int('price', new IntRule(0, self::MAX_AMOUNT));
    }

    private static function minStock(JsonObject $body): int
    {
        return $body->int('minStock', new IntRule(0, self::MAX_AMOUNT, optional: true));
    }
}
