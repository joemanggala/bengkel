<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Security\Password;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** bcrypt cost 12 yang hash-nya bisa diperiksa bergantian oleh backend Go, NestJS, dan Laravel. */
final class PasswordTest extends TestCase
{
    private const SANDI = 'SandiUji123!';

    /**
     * Hash sandi yang sama buatan tiap bahasa: Go (golang.org/x/crypto/bcrypt),
     * Node (bcryptjs), dan PHP (password_hash), semuanya cost 12.
     *
     * @return array<string, array{string}>
     */
    public static function crossBackendHashes(): array
    {
        return [
            'Go $2a$' => ['$2a$12$uiwMxTAPxKYOQ6zeNPBTZ.SYToTt6hkH5PAoEgQyXNQxz3RcOu1tK'],
            'Node $2b$' => ['$2b$12$iZw1TR5AXuH0lwv.WjE4/.At/L7Iz35ReRJXij4xXPO1034lKMQo6'],
            'PHP $2y$' => ['$2y$12$WyfbhN9dVbxpkNRpTaHgaOUKWu4GU0hl0Fjs.6DBUZrgOd2ymvcJC'],
        ];
    }

    #[DataProvider('crossBackendHashes')]
    public function test_hash_from_any_backend_is_accepted(string $hash): void
    {
        $this->assertTrue(Password::verify(self::SANDI, $hash));
        $this->assertFalse(Password::verify('SandiUji123?', $hash));
    }

    public function test_new_hash_uses_bcrypt_cost_12(): void
    {
        $hash = Password::hash(self::SANDI);

        // Awalan yang diterima CHECK staff_password_hash_bcrypt di database.
        $this->assertStringStartsWith('$2y$12$', $hash);
        $this->assertSame(60, strlen($hash));
        $this->assertTrue(Password::verify(self::SANDI, $hash));
        $this->assertFalse(Password::verify('sandi lain', $hash));
    }

    public function test_go_style_prefix_of_php_hash_still_verifies(): void
    {
        // $2a$, $2b$, dan $2y$ adalah algoritma yang sama untuk sandi ASCII;
        // Go menulis ulang awalannya menjadi $2a$ bila memperbarui hash.
        $hash = Password::hash(self::SANDI);

        $this->assertTrue(Password::verify(self::SANDI, '$2a$'.substr($hash, 4)));
        $this->assertTrue(Password::verify(self::SANDI, '$2b$'.substr($hash, 4)));
    }

    public function test_seventy_two_bytes_is_the_limit(): void
    {
        $this->assertTrue(Password::verify(str_repeat('é', 36), Password::hash(str_repeat('é', 36))));

        $this->expectException(InvalidArgumentException::class);
        Password::hash(str_repeat('a', 73));
    }

    public function test_nul_byte_is_refused_instead_of_crashing(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Password::hash("sandi\0rahasia");
    }

    public function test_broken_hash_never_verifies(): void
    {
        $this->assertFalse(Password::verify(self::SANDI, ''));
        $this->assertFalse(Password::verify(self::SANDI, 'bukan-hash-bcrypt'));
    }
}
