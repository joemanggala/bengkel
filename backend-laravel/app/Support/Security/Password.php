<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Security;

use InvalidArgumentException;

/**
 * Hash sandi staf dengan bcrypt cost 12.
 *
 * Satu database bisa dipakai bergantian oleh backend Go, Laravel, dan
 * NestJS, jadi hash buatan satu backend wajib bisa diperiksa backend lain.
 * Ketiganya memakai algoritma bcrypt yang sama; yang berbeda hanya awalan
 * versinya: Go menulis $2a$, Node $2b$, dan PHP $2y$. password_verify
 * menerima ketiganya, begitu pula pustaka bcrypt Go dan Node.
 */
final class Password
{
    public const BCRYPT_COST = 12;

    /** bcrypt hanya membaca 72 byte pertama sandi. */
    public const MAX_BYTES = 72;

    /**
     * Hash bcrypt cost 12 dari sandi yang tidak dipakai akun mana pun.
     * Dipakai saat email tidak dikenal, supaya lama balasan masuk sama dengan
     * email yang dikenal dan daftar email staf tidak bisa ditebak dari waktunya.
     */
    private const DUMMY_HASH = '$2y$12$w0Cfu0YVna9EXGWAx1BGwuZpEnCFq4mDEpSQNC6EjLGPWKZ/4Bmvq';

    /**
     * Sandi lebih dari 72 byte atau memuat NUL ditolak, bukan dipotong diam-
     * diam: Go menolak keduanya juga, jadi aturan ini menjaga ketiga backend
     * tetap sama. Validasi masukan semestinya sudah menyaring keduanya.
     */
    public static function hash(string $plain): string
    {
        if (strlen($plain) > self::MAX_BYTES || str_contains($plain, "\0")) {
            throw new InvalidArgumentException('sandi lebih dari 72 byte atau memuat NUL');
        }

        return password_hash($plain, PASSWORD_BCRYPT, ['cost' => self::BCRYPT_COST]);
    }

    /** Dibandingkan dalam waktu konstan oleh password_verify. */
    public static function verify(string $plain, string $hash): bool
    {
        return password_verify($plain, $hash);
    }

    /** Menghabiskan waktu yang sama dengan verify() untuk email yang tidak dikenal. */
    public static function verifyDummy(string $plain): void
    {
        password_verify($plain, self::DUMMY_HASH);
    }
}
