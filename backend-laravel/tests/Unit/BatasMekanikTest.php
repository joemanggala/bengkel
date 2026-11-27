<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Servis\BatasMekanik;
use App\Modules\Sesi\Peran;
use App\Modules\Sesi\SesiStaf;
use App\Support\Http\ApiError;
use App\Support\Validation\JsonObject;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Mekanik hanya melihat dan mengubah SPK miliknya, dan di PATCH hanya boleh diagnosis. */
final class BatasMekanikTest extends TestCase
{
    private const MEKANIK = '55555555-5555-4555-8555-555555555555';

    private const MEKANIK_LAIN = '66666666-6666-4666-8666-666666666666';

    private static function sesi(Peran $peran, string $staffId = self::MEKANIK): SesiStaf
    {
        return new SesiStaf('sesi', $staffId, $peran, '2026-12-27 00:00:00.000', '2026-11-27 00:00:00.000');
    }

    private function assertForbidden(callable $aksi): void
    {
        try {
            $aksi();
            $this->fail('seharusnya 403');
        } catch (ApiError $e) {
            $this->assertSame([403, 'forbidden'], [$e->status, $e->errorCode]);
        }
    }

    public function test_mechanic_opens_only_own_work_order(): void
    {
        BatasMekanik::bolehBuka(self::sesi(Peran::Mekanik), self::MEKANIK);
        $this->assertForbidden(fn () => BatasMekanik::bolehBuka(self::sesi(Peran::Mekanik), self::MEKANIK_LAIN));
        // SPK yang belum punya mekanik juga bukan miliknya.
        $this->assertForbidden(fn () => BatasMekanik::bolehBuka(self::sesi(Peran::Mekanik), null));
    }

    public function test_owner_and_cashier_open_every_work_order(): void
    {
        foreach ([Peran::Pemilik, Peran::Kasir] as $peran) {
            BatasMekanik::bolehBuka(self::sesi($peran), self::MEKANIK_LAIN);
            BatasMekanik::bolehBuka(self::sesi($peran), null);
        }
        $this->addToAssertionCount(4);
    }

    /** @return array<string, array{string}> */
    public static function cashierOnlyBodies(): array
    {
        return [
            'mechanicId' => ['{"mechanicId":"66666666-6666-4666-8666-666666666666"}'],
            'mechanicId null' => ['{"mechanicId":null}'],
            'complaint' => ['{"complaint":"Rem bunyi"}'],
            'odometer null' => ['{"odometer":null}'],
            'estimatedDoneAt' => ['{"estimatedDoneAt":"2026-11-28T08:00:00Z"}'],
            'bersama diagnosis' => ['{"diagnosis":"Kampas habis","complaint":"x"}'],
            'nilai yang salah pun tetap 403' => ['{"complaint":123}'],
        ];
    }

    #[DataProvider('cashierOnlyBodies')]
    public function test_mechanic_patch_with_cashier_only_key_is_403(string $json): void
    {
        $this->assertForbidden(fn () => BatasMekanik::bolehUbah(self::sesi(Peran::Mekanik), JsonObject::parse($json)));
    }

    public function test_mechanic_may_send_diagnosis_or_nothing_and_cashier_anything(): void
    {
        BatasMekanik::bolehUbah(self::sesi(Peran::Mekanik), JsonObject::parse('{}'));
        BatasMekanik::bolehUbah(self::sesi(Peran::Mekanik), JsonObject::parse('{"diagnosis":"Kampas habis","lain":1}'));
        BatasMekanik::bolehUbah(self::sesi(Peran::Kasir), JsonObject::parse('{"complaint":"x","mechanicId":null}'));
        $this->addToAssertionCount(3);
    }

    public function test_list_filter_is_forced_to_the_mechanic_self(): void
    {
        $this->assertSame(self::MEKANIK, BatasMekanik::saringanDaftar(self::sesi(Peran::Mekanik), self::MEKANIK_LAIN));
        $this->assertSame(self::MEKANIK, BatasMekanik::saringanDaftar(self::sesi(Peran::Mekanik), null));
        $this->assertSame(self::MEKANIK_LAIN, BatasMekanik::saringanDaftar(self::sesi(Peran::Kasir), self::MEKANIK_LAIN));
        $this->assertNull(BatasMekanik::saringanDaftar(self::sesi(Peran::Pemilik), null));
    }
}
