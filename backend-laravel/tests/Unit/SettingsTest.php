<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Config\ConfigurationError;
use App\Support\Config\Settings;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Env diperiksa saat menyala; pesan galat menyebut nama env, tidak pernah isinya. */
final class SettingsTest extends TestCase
{
    private const VALID = [
        'PORT' => '8882',
        'DATABASE_URL' => 'mysql://bengkel:rahasia-db@127.0.0.1:3350/bengkel_uji_laravel',
        'SETUP_TOKEN' => '',
        'WA_API_URL' => 'http://localhost:8892/send',
        'WA_TOKEN' => 'rahasia-wa',
        'PUBLIC_WEB_URL' => 'http://localhost:3800',
    ];

    /** @param  array<string, string>  $values */
    private static function load(array $values): Settings
    {
        return Settings::fromReader(fn (string $name): string => $values[$name] ?? '');
    }

    private function expectProblem(array $values, string $problem, string ...$secrets): void
    {
        try {
            self::load($values);
            $this->fail('seharusnya ditolak: '.$problem);
        } catch (ConfigurationError $e) {
            $this->assertStringContainsString($problem, $e->getMessage());
            foreach ($secrets as $secret) {
                $this->assertStringNotContainsString($secret, $e->getMessage());
            }
        }
    }

    public function test_valid_environment_is_trimmed_including_crlf(): void
    {
        $settings = self::load([
            'PORT' => " 8882\r\n",
            'SETUP_TOKEN' => " token-setup-uji-bengkel-bukan-rahasia\r\n",
            'WA_TOKEN' => "\trahasia-wa\r",
        ] + self::VALID);

        $this->assertSame(8882, $settings->port);
        $this->assertSame(self::VALID['DATABASE_URL'], $settings->databaseUrl);
        $this->assertSame('token-setup-uji-bengkel-bukan-rahasia', $settings->setupToken);
        // Alamat kirim dipakai apa adanya, termasuk path-nya.
        $this->assertSame('http://localhost:8892/send', $settings->waApiUrl);
        $this->assertSame('rahasia-wa', $settings->waToken);
    }

    public function test_setup_token_may_be_empty_or_blank(): void
    {
        $this->assertSame('', self::load(self::VALID)->setupToken);
        $this->assertSame('', self::load(['SETUP_TOKEN' => " \r\n"] + self::VALID)->setupToken);
    }

    /** @return array<string, array{string}> */
    public static function setupTokenContoh(): array
    {
        return [
            'contoh dokumentasi' => ['token-setup-dev-bukan-rahasia'],
            'contoh panduan VPS, huruf kecil' => ['hasil_rand_hex_16'],
        ];
    }

    // Nilai contoh di dokumentasi terbaca semua pembeli, jadi tidak melindungi apa pun.
    #[DataProvider('setupTokenContoh')]
    public function test_setup_token_must_not_be_a_documented_example(string $token): void
    {
        $this->expectProblem(['SETUP_TOKEN' => $token] + self::VALID, 'SETUP_TOKEN masih nilai contoh', $token);
    }

    public function test_all_problems_are_reported_at_once_without_values(): void
    {
        try {
            self::load(['PORT' => '99999', 'WA_TOKEN' => 'rahasia wa', 'SETUP_TOKEN' => 'singkat']);
            $this->fail('seharusnya ditolak');
        } catch (ConfigurationError $e) {
            $message = $e->getMessage();
            $this->assertStringContainsString('PORT harus bilangan bulat 1..65535', $message);
            $this->assertStringContainsString('DATABASE_URL wajib diisi', $message);
            $this->assertStringContainsString('WA_API_URL wajib diisi', $message);
            $this->assertStringContainsString('PUBLIC_WEB_URL wajib diisi', $message);
            $this->assertStringContainsString('WA_TOKEN hanya boleh berisi karakter ASCII terlihat', $message);
            $this->assertStringContainsString('SETUP_TOKEN minimal 16 byte', $message);
            foreach (['rahasia wa', 'singkat', '99999'] as $secret) {
                $this->assertStringNotContainsString($secret, $message);
            }
        }
    }

    public function test_port_is_required(): void
    {
        $this->expectProblem(['PORT' => '  '] + self::VALID, 'PORT wajib diisi');
    }

    public function test_lengths_are_counted_in_bytes(): void
    {
        // 8 huruf "é" = 16 byte: cukup untuk SETUP_TOKEN walau hanya 8 karakter.
        $this->assertSame(str_repeat('é', 8), self::load(['SETUP_TOKEN' => str_repeat('é', 8)] + self::VALID)->setupToken);
        // 7 huruf "é" + 1 huruf = 15 byte: kurang satu.
        $this->expectProblem(['SETUP_TOKEN' => str_repeat('é', 7).'k'] + self::VALID, 'SETUP_TOKEN minimal 16 byte');
        $this->assertSame(str_repeat('t', 16), self::load(['SETUP_TOKEN' => str_repeat('t', 16)] + self::VALID)->setupToken);
    }

    /** @return array<string, array{string, string}> */
    public static function publicWebUrls(): array
    {
        return [
            'tanpa garis miring' => ['https://bengkelku.id', 'https://bengkelku.id'],
            'garis miring di akhir dibuang' => ['https://bengkelku.id/', 'https://bengkelku.id'],
            'beberapa garis miring di akhir' => ['http://localhost:3800//', 'http://localhost:3800'],
            'dengan path' => ['https://contoh.id/bengkel/', 'https://contoh.id/bengkel'],
            'dipangkas' => [" http://localhost:3800\r\n", 'http://localhost:3800'],
        ];
    }

    #[DataProvider('publicWebUrls')]
    public function test_public_web_url_drops_trailing_slashes(string $env, string $expected): void
    {
        $this->assertSame($expected, self::load(['PUBLIC_WEB_URL' => $env] + self::VALID)->publicWebUrl);
    }

    /** @return array<string, array{string}> */
    public static function badPublicWebUrls(): array
    {
        return [
            'tanpa skema' => ['bengkelku.id'],
            'skema lain' => ['ftp://bengkelku.id'],
            'skema huruf besar' => ['HTTPS://bengkelku.id'],
            'spasi di tengah' => ['https://bengkel ku.id'],
            'tab di tengah' => ["https://bengkel\tku.id"],
            'hanya skema' => ['https://'],
            'hanya skema dan garis miring' => ['https:///'],
        ];
    }

    #[DataProvider('badPublicWebUrls')]
    public function test_public_web_url_must_be_http_without_spaces(string $url): void
    {
        $this->expectProblem(['PUBLIC_WEB_URL' => $url] + self::VALID, 'PUBLIC_WEB_URL harus diawali http:// atau https://');
    }

    /** @return array<string, array{string}> */
    public static function badWaUrls(): array
    {
        return [
            'tanpa skema' => ['localhost:8892/send'],
            'skema lain' => ['ftp://localhost/send'],
            'tanpa path' => ['http://localhost:8892'],
            'path hanya garis miring' => ['https://api.fonnte.com/'],
        ];
    }

    #[DataProvider('badWaUrls')]
    public function test_wa_api_url_must_be_full_send_address(string $url): void
    {
        $this->expectProblem(['WA_API_URL' => $url] + self::VALID, 'WA_API_URL harus alamat kirim http(s) lengkap dengan path');
    }

    public function test_database_url_must_be_mysql_url(): void
    {
        $this->expectProblem(['DATABASE_URL' => 'postgres://u:p@localhost/bengkel'] + self::VALID,
            'DATABASE_URL harus berbentuk mysql://', 'u:p');
    }

    public function test_port_must_be_plain_digits(): void
    {
        $this->expectProblem(['PORT' => '88O2'] + self::VALID, 'PORT harus bilangan bulat');
    }

    /** @return array<string, array{string}> */
    public static function badWaTokens(): array
    {
        return [
            'spasi di tengah' => ['token rahasia'],
            'tab di tengah' => ["token\trahasia"],
            'huruf non-ASCII' => ['tokén'],
            'karakter kendali' => ["token\x01"],
        ];
    }

    #[DataProvider('badWaTokens')]
    public function test_wa_token_must_be_visible_ascii(string $token): void
    {
        $this->expectProblem(['WA_TOKEN' => $token] + self::VALID, 'WA_TOKEN hanya boleh berisi karakter ASCII terlihat', $token);
    }

    public function test_wa_token_may_use_all_visible_ascii(): void
    {
        $token = implode('', array_map('chr', range(0x21, 0x7E)));

        $this->assertSame($token, self::load(['WA_TOKEN' => $token] + self::VALID)->waToken);
    }
}
