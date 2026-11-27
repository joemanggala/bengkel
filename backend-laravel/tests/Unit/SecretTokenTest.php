<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Security\SecretToken;
use App\Support\Security\Uuid;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Token sesi: 43 karakter base64url acak, database hanya menyimpan hex SHA-256-nya. */
final class SecretTokenTest extends TestCase
{
    public function test_new_token_is_43_base64url_chars_and_hash_is_its_sha256(): void
    {
        [$plain, $hash] = SecretToken::new();

        $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/D', $plain);
        $this->assertTrue(SecretToken::valid($plain));
        $this->assertSame(hash('sha256', $plain), $hash);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/D', $hash);
    }

    public function test_tokens_are_random(): void
    {
        $tokens = [];
        for ($i = 0; $i < 100; $i++) {
            $tokens[] = SecretToken::new()[0];
        }

        $this->assertCount(100, array_unique($tokens));
    }

    public function test_hash_matches_known_vector(): void
    {
        // Vektor dari `printf %s <token> | sha256sum`. Hash yang sama di
        // backend mana pun membuat satu tabel sesi bisa dipakai bergantian oleh
        // Go, Laravel, dan NestJS.
        $token = 'contohTokenSesiBengkelku_0123456789-abcdefg';

        $this->assertTrue(SecretToken::valid($token));
        $this->assertSame('316f0a543c54c47c6419041f164bdbef0ec521c644656fe17e5870f5f6c1fb9a', SecretToken::hash($token));
    }

    /** @return array<string, array{string}> */
    public static function malformedTokens(): array
    {
        return [
            'kosong' => [''],
            '42 karakter' => [str_repeat('a', 42)],
            '44 karakter' => [str_repeat('a', 44)],
            'karakter base64 biasa' => [str_repeat('a', 42).'+'],
            'padding' => [str_repeat('a', 42).'='],
            'baris baru di akhir' => [str_repeat('a', 43)."\n"],
            'spasi' => [str_repeat('a', 42).' '],
        ];
    }

    #[DataProvider('malformedTokens')]
    public function test_malformed_token_is_rejected_before_touching_database(string $token): void
    {
        $this->assertFalse(SecretToken::valid($token));
    }

    public function test_uuid_is_lowercase_version_4(): void
    {
        $id = Uuid::new();

        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D', $id);
        $this->assertTrue(Uuid::valid($id));
        $this->assertFalse(Uuid::valid(strtoupper($id)));
        $this->assertFalse(Uuid::valid($id."\n"));
    }
}
