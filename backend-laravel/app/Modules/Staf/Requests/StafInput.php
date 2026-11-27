<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Staf\Requests;

use App\Modules\Sesi\Peran;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;

/**
 * Aturan field staf, dipakai bersama oleh setup, membuat staf, dan mengubah
 * staf supaya ketiganya menilai nama, email, dan sandi dengan cara yang sama.
 */
final class StafInput
{
    /** Pola email ASCII dari spec; dicocokkan setelah dipangkas dan A-Z dikecilkan. */
    private const EMAIL = '/^[a-z0-9.!#$%&\'*+\/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/D';

    public static function name(JsonObject $body): string
    {
        return $body->text('name', new TextRule(trim: true, min: 2, max: 100));
    }

    public static function email(JsonObject $body): string
    {
        return $body->text('email', new TextRule(trim: true, lowerAscii: true, max: 254, pattern: self::EMAIL));
    }

    /**
     * Sandi tidak dipangkas. Panjang dihitung dalam byte karena bcrypt hanya
     * membaca 72 byte pertama, dan NUL ditolak (invalid_format) karena
     * pustaka bcrypt berbeda-beda menanganinya. Panjang dinilai lebih dulu.
     */
    public static function password(JsonObject $body): string
    {
        return $body->text('password', new TextRule(min: 8, max: 72, countBytes: true, pattern: '/^[^\x00]*$/D'));
    }

    public static function role(JsonObject $body): ?Peran
    {
        $role = $body->choice('role', array_map(fn (Peran $p): string => $p->value, Peran::cases()));

        return $role === '' ? null : Peran::from($role);
    }
}
