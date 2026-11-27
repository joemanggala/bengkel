<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Jasa\Requests;

use App\Support\Validation\IntRule;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;

/**
 * Aturan field jasa (BuatJasaRequest dan UbahJasaRequest). Keduanya memakai
 * aturan yang sama per field; bedanya hanya apa arti "tidak dikirim": saat
 * membuat berarti nilai bawaan, saat mengubah berarti tidak berubah.
 *
 * Hasilnya langsung berupa kolom tabel services, supaya service tidak perlu
 * menerjemahkan nama field lagi.
 */
final class JasaInput
{
    public const MAX_PRICE = 100_000_000;

    public const MAX_DURATION = 1440;

    public const MAX_SORT_ORDER = 100_000;

    /**
     * Badan POST /api/services. Field wajib: name, price. Opsional dengan
     * bawaan: description "", durationMinutes null, isPublic true, isActive
     * true, sortOrder 0. null pada field opsional selain durationMinutes →
     * invalid_type (aturan "Tipe JSON").
     *
     * @return array<string, mixed>
     */
    public static function buat(JsonObject $body): array
    {
        return [
            'name' => self::name($body),
            'description' => self::description($body),
            'price' => self::price($body),
            'duration_minutes' => $body->nullableInt('durationMinutes', 1, self::MAX_DURATION),
            'is_public' => $body->bool('isPublic', optional: true, default: true),
            'is_active' => $body->bool('isActive', optional: true, default: true),
            'sort_order' => self::sortOrder($body),
        ];
    }

    /**
     * Badan PATCH: hanya field yang dikirim yang dinilai dan ikut diubah.
     * null pada name atau price → required (aturan teks/integer wajib);
     * null pada durationMinutes = mengosongkan durasi; null pada field lain →
     * invalid_type.
     *
     * @return array<string, mixed> kolom → nilai baru (hanya yang dikirim)
     */
    public static function ubah(JsonObject $body): array
    {
        $changes = [];
        if ($body->has('name')) {
            $changes['name'] = self::name($body);
        }
        if ($body->has('description')) {
            $changes['description'] = self::description($body);
        }
        if ($body->has('price')) {
            $changes['price'] = self::price($body);
        }
        if ($body->has('durationMinutes')) {
            // Kuncinya tetap dicatat walau nilainya null: null di sini berarti
            // "kosongkan durasi", bukan "tidak berubah".
            $changes['duration_minutes'] = $body->nullableInt('durationMinutes', 1, self::MAX_DURATION);
        }
        if ($body->has('isPublic')) {
            $changes['is_public'] = $body->bool('isPublic', optional: true);
        }
        if ($body->has('isActive')) {
            $changes['is_active'] = $body->bool('isActive', optional: true);
        }
        if ($body->has('sortOrder')) {
            $changes['sort_order'] = self::sortOrder($body);
        }

        return $changes;
    }

    private static function name(JsonObject $body): string
    {
        return $body->text('name', new TextRule(trim: true, min: 2, max: 100));
    }

    private static function description(JsonObject $body): string
    {
        return $body->text('description', new TextRule(optional: true, trim: true, max: 1000));
    }

    private static function price(JsonObject $body): int
    {
        return $body->int('price', new IntRule(0, self::MAX_PRICE));
    }

    private static function sortOrder(JsonObject $body): int
    {
        return $body->int('sortOrder', new IntRule(0, self::MAX_SORT_ORDER, optional: true));
    }
}
