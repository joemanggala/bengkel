<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Console\Commands\ServeCommand;
use PHPUnit\Framework\TestCase;

/**
 * Opsi `php -S` yang dibangun bengkel:serve, diuji tanpa menyalakan server.
 * Bukti bahwa balasan tetap JSON bersih saat ada lebih dari 1.000 parameter
 * query atau cookie ada di tes kontrak (tes/masukan-tepi.test.ts).
 */
final class ServeCommandTest extends TestCase
{
    /** @return array<string, string> nama pengaturan → nilai, dari pasangan "-d nama=nilai" */
    private function pengaturan(): array
    {
        $opsi = (new ServeCommand)->iniOptions();
        $hasil = [];
        for ($i = 0; $i < count($opsi); $i += 2) {
            $this->assertSame('-d', $opsi[$i], 'setiap pengaturan harus diawali -d');
            [$nama, $nilai] = explode('=', $opsi[$i + 1], 2);
            $hasil[$nama] = $nilai;
        }

        return $hasil;
    }

    public function test_warnings_never_go_to_the_response_body_but_are_logged_to_stderr(): void
    {
        $ini = $this->pengaturan();

        // "Input variables exceeded 1000" ditulis PHP sebelum kode aplikasi jalan, jadi
        // satu-satunya cara menjaga badan JSON bersih adalah mematikannya di php -S.
        $this->assertSame('0', $ini['display_errors']);
        $this->assertSame('1', $ini['log_errors']);
        $this->assertSame('php://stderr', $ini['error_log']);
    }

    public function test_the_raw_body_and_header_settings_are_still_there(): void
    {
        $ini = $this->pengaturan();

        $this->assertSame('0', $ini['enable_post_data_reading']);
        $this->assertSame('0', $ini['expose_php']);
        $this->assertSame('1', $ini['opcache.enable_cli']);
    }

    public function test_every_required_setting_is_passed_as_its_own_d_option(): void
    {
        $opsi = (new ServeCommand)->iniOptions();

        foreach (ServeCommand::INI_WAJIB as $setting) {
            $this->assertContains($setting, $opsi);
        }
        $this->assertCount(count($opsi) / 2, array_keys($opsi, '-d', true), 'tidak ada opsi tanpa -d');
    }
}
