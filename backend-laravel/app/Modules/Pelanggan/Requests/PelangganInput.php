<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Pelanggan\Requests;

use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;

/**
 * Aturan field pelanggan (BuatPelangganRequest, UbahPelangganRequest).
 * Membuat dan mengubah memakai aturan yang sama; bedanya hanya PATCH menilai
 * field yang dikirim saja. Hasilnya kolom tabel customers → nilai siap
 * simpan. Galat dicatat di $body; pemanggil memanggil throwIfInvalid().
 */
final class PelangganInput
{
    /** @return array{name: string, phone: string, address: string, notes: string} */
    public static function baru(JsonObject $body): array
    {
        return [
            'name' => self::name($body),
            'phone' => $body->phone('phone'),
            'address' => self::address($body),
            'notes' => self::notes($body),
        ];
    }

    /**
     * Hanya field yang dikirim yang masuk hasil, jadi UPDATE tidak menimpa
     * kolom yang tidak disebut (dua PATCH serentak untuk field berbeda
     * sama-sama bertahan). `{}` menghasilkan larik kosong.
     *
     * @return array<string, string>
     */
    public static function perubahan(JsonObject $body): array
    {
        $changes = [];
        if ($body->has('name')) {
            $changes['name'] = self::name($body);
        }
        if ($body->has('phone')) {
            // null → required, sama dengan saat membuat (phone() menilainya begitu).
            $changes['phone'] = $body->phone('phone');
        }
        if ($body->has('address')) {
            $changes['address'] = self::address($body);
        }
        if ($body->has('notes')) {
            $changes['notes'] = self::notes($body);
        }

        return $changes;
    }

    /** Skema Nama: dipangkas, 2–100 code point; null → required. */
    private static function name(JsonObject $body): string
    {
        return $body->text('name', new TextRule(trim: true, min: 2, max: 100));
    }

    /** Opsional, bawaan ""; null → invalid_type. Pergantian baris di tengah dipertahankan. */
    private static function address(JsonObject $body): string
    {
        return $body->text('address', new TextRule(optional: true, trim: true, max: 500));
    }

    /** Catatan internal kasir; aturannya sama dengan alamat. */
    private static function notes(JsonObject $body): string
    {
        return $body->text('notes', new TextRule(optional: true, trim: true, max: 500));
    }
}
