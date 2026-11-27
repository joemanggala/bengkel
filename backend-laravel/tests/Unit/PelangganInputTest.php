<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Pelanggan\Requests\KendaraanInput;
use App\Modules\Pelanggan\Requests\PelangganInput;
use App\Support\Validation\JsonObject;
use PHPUnit\Framework\TestCase;

/**
 * Lapisan masukan modul Pelanggan: badan JSON → kolom siap simpan. Yang
 * diuji di sini hal yang tidak terlihat dari luar: PATCH hanya membawa kolom
 * yang dikirim, `year: null` tetap dibawa (mengosongkan tahun), dan satu
 * field plat menjadi dua kolom.
 */
final class PelangganInputTest extends TestCase
{
    public function test_pelanggan_baru_dinormalisasi_dengan_bawaan_kosong(): void
    {
        $body = JsonObject::parse('{"name":"  Budi Santoso ","phone":"0812-3456-7890","vehicles":[]}');

        $kolom = PelangganInput::baru($body);

        $this->assertTrue($body->errors()->isEmpty());
        $this->assertSame(['name' => 'Budi Santoso', 'phone' => '6281234567890', 'address' => '', 'notes' => ''], $kolom);
    }

    public function test_perubahan_pelanggan_hanya_field_yang_dikirim(): void
    {
        $this->assertSame([], PelangganInput::perubahan(JsonObject::parse('{"bebas":1}')));
        $this->assertSame(['notes' => ''], PelangganInput::perubahan(JsonObject::parse('{"notes":"   "}')));
    }

    public function test_perubahan_pelanggan_null_mengikuti_aturan_skema(): void
    {
        $body = JsonObject::parse('{"name":null,"phone":null,"address":null,"notes":null}');

        PelangganInput::perubahan($body);

        $this->assertSame(
            ['name' => 'required', 'phone' => 'required', 'address' => 'invalid_type', 'notes' => 'invalid_type'],
            $body->errors()->all(),
        );
    }

    public function test_kendaraan_baru_memecah_plat_menjadi_kunci_dan_tampilan(): void
    {
        $body = JsonObject::parse('{"type":"MOTOR","plate":"b 1234-xyz","brand":" Honda ","customerId":"x"}');

        $kolom = KendaraanInput::baru($body);

        $this->assertTrue($body->errors()->isEmpty());
        $this->assertSame([
            'type' => 'MOTOR',
            'plate_key' => 'B1234XYZ',
            'plate_display' => 'B 1234 XYZ',
            'brand' => 'Honda',
            'model' => '',
            'year' => null,
            'color' => '',
        ], $kolom);
    }

    public function test_perubahan_kendaraan_year_null_berarti_mengosongkan(): void
    {
        $body = JsonObject::parse('{"year":null,"color":"  Merah "}');

        $this->assertSame(['year' => null, 'color' => 'Merah'], KendaraanInput::perubahan($body));
        $this->assertTrue($body->errors()->isEmpty());
        $this->assertSame([], KendaraanInput::perubahan(JsonObject::parse('{}')));
    }

    public function test_perubahan_kendaraan_null_pada_field_wajib_adalah_required(): void
    {
        $body = JsonObject::parse('{"type":null,"plate":null,"brand":null,"model":null,"color":null}');

        KendaraanInput::perubahan($body);

        $this->assertSame(
            ['type' => 'required', 'plate' => 'required', 'brand' => 'required', 'model' => 'invalid_type', 'color' => 'invalid_type'],
            $body->errors()->all(),
        );
    }
}
