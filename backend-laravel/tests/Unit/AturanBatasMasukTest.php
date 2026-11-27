<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Security\AturanBatasMasuk;
use App\Support\Time\Time;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Fakes\BatasMasukMemori;
use Tests\Fakes\FixedClock;

/** Aturan pembatas login: 10 percobaan, lalu kunci 15 menit sejak percobaan ke-10. */
final class AturanBatasMasukTest extends TestCase
{
    private function coba(BatasMasukMemori $batas, FixedClock $clock, string $nama = 'a@x.id'): int
    {
        return $batas->coba($nama, $clock->now());
    }

    public function test_sepuluh_percobaan_boleh_ke_sebelas_dikunci_dihitung_dari_ke_sepuluh(): void
    {
        $batas = new BatasMasukMemori;
        $clock = new FixedClock;
        for ($i = 1; $i <= 10; $i++) {
            $clock->advanceSeconds(1);
            $this->assertSame(0, $this->coba($batas, $clock), "percobaan $i");
        }
        $clock->advanceSeconds(1);
        $this->assertSame(AturanBatasMasuk::KUNCI_DETIK - 1, $this->coba($batas, $clock));
    }

    public function test_kunci_berakhir_lalu_hitungan_mulai_baru(): void
    {
        $batas = new BatasMasukMemori;
        $clock = new FixedClock;
        for ($i = 0; $i < 10; $i++) {
            $this->coba($batas, $clock);
        }
        $clock->advanceSeconds(AturanBatasMasuk::KUNCI_DETIK - 1);
        $this->assertGreaterThan(0, $this->coba($batas, $clock));
        $clock->advanceSeconds(1);
        $this->assertSame(0, $this->coba($batas, $clock));
        for ($i = 0; $i < 8; $i++) {
            $this->assertSame(0, $this->coba($batas, $clock));
        }
        $this->assertSame(0, $this->coba($batas, $clock), 'ke-10 dari hitungan baru');
        $this->assertGreaterThan(0, $this->coba($batas, $clock), 'ke-11 dari hitungan baru');
    }

    public function test_berhasil_menghapus_hitungan(): void
    {
        $batas = new BatasMasukMemori;
        $clock = new FixedClock;
        for ($i = 0; $i < 9; $i++) {
            $this->coba($batas, $clock);
        }
        $batas->berhasil('a@x.id');
        for ($i = 0; $i < 10; $i++) {
            $this->assertSame(0, $this->coba($batas, $clock));
        }
        $this->assertGreaterThan(0, $this->coba($batas, $clock));
    }

    public function test_percobaan_lama_di_luar_jendela_tidak_dihitung_bersama(): void
    {
        $batas = new BatasMasukMemori;
        $clock = new FixedClock;
        for ($i = 0; $i < 9; $i++) {
            $this->coba($batas, $clock);
        }
        $clock->advanceSeconds(AturanBatasMasuk::JENDELA_DETIK);
        for ($i = 0; $i < 10; $i++) {
            $this->assertSame(0, $this->coba($batas, $clock), 'percobaan '.($i + 1));
        }
    }

    public function test_nama_berbeda_tidak_saling_mengunci(): void
    {
        $batas = new BatasMasukMemori;
        $clock = new FixedClock;
        for ($i = 0; $i < 10; $i++) {
            $this->coba($batas, $clock);
        }
        $this->assertGreaterThan(0, $this->coba($batas, $clock));
        $this->assertSame(0, $this->coba($batas, $clock, 'b@x.id'));
    }

    public function test_ditolak_tidak_mengubah_catatan(): void
    {
        $sekarang = new DateTimeImmutable('2026-11-10 08:00:00.000', new \DateTimeZone('UTC'));
        $lama = ['percobaan' => 10, 'mulai' => $sekarang, 'kunciSampai' => Time::plusSeconds($sekarang, 600)];
        $hasil = AturanBatasMasuk::terapkan($lama, Time::plusSeconds($sekarang, 100));
        $this->assertFalse($hasil['berubah']);
        $this->assertSame(500, $hasil['sisaDetik']);
        $this->assertSame($lama, $hasil['catatan']);
    }

    /** @return array<string, array{int, int}> */
    public static function pembulatan(): array
    {
        return ['nol' => [0, 1], '1 ms' => [1, 1], '1 detik' => [1000, 1], '1,5 detik' => [1500, 2], '15 menit' => [900_000, 900]];
    }

    #[DataProvider('pembulatan')]
    public function test_detik_tunggu_dibulatkan_ke_atas_minimal_satu(int $ms, int $detik): void
    {
        $this->assertSame($detik, AturanBatasMasuk::detikTunggu($ms));
    }
}
