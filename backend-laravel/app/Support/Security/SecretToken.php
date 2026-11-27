<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Security;

/**
 * Token acak untuk sesi staf (TokenSesi), token booking, dan token lacak SPK
 * (TokenPublik). Ketiganya dibuat dengan aturan yang sama di semua backend:
 * 32 byte acak kriptografis, base64url tanpa padding, 43 karakter.
 *
 * Klien menerima token aslinya, sedangkan database hanya menyimpan hex
 * SHA-256-nya (sesi staf dan token booking), dihitung atas byte ASCII token
 * apa adanya, bukan hasil dekode base64-nya. Pengecualian: token lacak SPK
 * disimpan apa adanya (keputusan 0a-1), karena pesan "siap diambil" dan nota
 * yang dikirim belakangan harus bisa memuat tautannya. Bila isi tabel sesi
 * bocor, token aslinya tetap tidak bisa dipakai untuk masuk. SHA-256 tanpa garam cukup di sini (berbeda dengan
 * sandi), karena token berisi 256 bit acak sehingga tidak bisa ditebak lewat
 * kamus.
 */
final class SecretToken
{
    /** @return array{0: string, 1: string} token asli dan hash-nya */
    public static function new(): array
    {
        // 32 byte acak kriptografis dalam base64url tanpa padding = 43 karakter.
        $plain = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');

        return [$plain, self::hash($plain)];
    }

    /** Hex SHA-256 huruf kecil, 64 karakter: nilai kolom token_hash. */
    public static function hash(string $plain): string
    {
        return hash('sha256', $plain);
    }

    /**
     * Bentuk token diperiksa sebelum menyentuh database, supaya teks sembarang
     * di header Authorization tidak pernah sampai ke query.
     */
    public static function valid(string $plain): bool
    {
        return preg_match('/^[A-Za-z0-9_-]{43}$/D', $plain) === 1;
    }
}
