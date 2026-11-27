<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Pelanggan\Requests;

use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;

/**
 * Aturan field kendaraan (BuatKendaraanRequest, UbahKendaraanRequest).
 * Hasilnya kolom tabel vehicles → nilai siap simpan; satu field `plate`
 * menjadi dua kolom (plate_key untuk keunikan dan pencarian, plate_display
 * untuk tampilan). customerId di badan tidak pernah dibaca: pemilik
 * ditentukan path saat membuat dan tidak bisa diganti sesudahnya.
 */
final class KendaraanInput
{
    /** Pilihan jenis kendaraan, dibandingkan persis tanpa dipangkas. */
    public const TYPES = ['MOTOR', 'CAR'];

    public const YEAR_MIN = 1900;

    public const YEAR_MAX = 2100;

    /** @return array<string, string|int|null> */
    public static function baru(JsonObject $body): array
    {
        return [
            'type' => $body->choice('type', self::TYPES),
            ...self::plate($body),
            'brand' => self::brand($body),
            'model' => self::model($body),
            // Tidak dikirim atau null → null (tahun tidak diisi).
            'year' => $body->nullableInt('year', self::YEAR_MIN, self::YEAR_MAX),
            'color' => self::color($body),
        ];
    }

    /**
     * Hanya field yang dikirim. `year: null` sengaja masuk hasil sebagai
     * null: di PATCH artinya mengosongkan tahun, bukan "tidak berubah".
     *
     * @return array<string, string|int|null>
     */
    public static function perubahan(JsonObject $body): array
    {
        $changes = [];
        if ($body->has('type')) {
            $changes['type'] = $body->choice('type', self::TYPES);
        }
        if ($body->has('plate')) {
            $changes += self::plate($body);
        }
        if ($body->has('brand')) {
            $changes['brand'] = self::brand($body);
        }
        if ($body->has('model')) {
            $changes['model'] = self::model($body);
        }
        if ($body->has('year')) {
            $changes['year'] = $body->nullableInt('year', self::YEAR_MIN, self::YEAR_MAX);
        }
        if ($body->has('color')) {
            $changes['color'] = self::color($body);
        }

        return $changes;
    }

    /**
     * Plat sudah dinormalisasi Plate (format sebelum panjang). Bila gagal,
     * nilainya tidak dipakai karena throwIfInvalid() melempar lebih dulu.
     *
     * @return array{plate_key: string, plate_display: string}
     */
    private static function plate(JsonObject $body): array
    {
        $plate = $body->plate('plate');

        return ['plate_key' => $plate->key ?? '', 'plate_display' => $plate->display ?? ''];
    }

    /** Merek: dipangkas, wajib, maks 50 code point; null → required. */
    private static function brand(JsonObject $body): string
    {
        return $body->text('brand', new TextRule(trim: true, max: 50));
    }

    /** Tipe (mis. "Vario 125"): opsional, bawaan ""; null → invalid_type. */
    private static function model(JsonObject $body): string
    {
        return $body->text('model', new TextRule(optional: true, trim: true, max: 50));
    }

    private static function color(JsonObject $body): string
    {
        return $body->text('color', new TextRule(optional: true, trim: true, max: 30));
    }
}
