<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Booking\NomorBooking;
use App\Modules\Servis\NomorSpk;
use App\Modules\Sesi\Peran;
use App\Modules\Sparepart\LevelStok;
use App\Modules\Stok\JenisPergerakan;
use App\Modules\Stok\PesanStokKurang;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Nomor SPK dan booking, tanda stok, jenis kartu stok, pesan stok kurang, dan peran staf. */
final class NomorDanStokTest extends TestCase
{
    public function test_numbers_have_at_least_four_digits_and_keep_growing(): void
    {
        $this->assertSame('S-0001', NomorSpk::dari(1));
        $this->assertSame('S-0012', NomorSpk::dari(12));
        $this->assertSame('S-9999', NomorSpk::dari(9_999));
        $this->assertSame('S-10000', NomorSpk::dari(10_000));
        $this->assertSame('B-0001', NomorBooking::dari(1));
        $this->assertSame('B-0007', NomorBooking::dari(7));
        $this->assertSame('B-10000', NomorBooking::dari(10_000));
    }

    public function test_number_zero_is_a_programming_error(): void
    {
        $this->expectException(InvalidArgumentException::class);
        NomorSpk::dari(0);
    }

    /** @return array<string, array{string, bool}> */
    public static function workOrderNumbers(): array
    {
        return [
            'empat digit' => ['S-0001', true],
            'lima digit' => ['S-10000', true],
            'huruf kecil' => ['s-0001', false],
            'kurang dari empat digit' => ['S-1', false],
            'baris baru di akhir' => ["S-0001\n", false],
            'nomor booking' => ['B-0001', false],
            'tanpa tanda hubung' => ['S0001', false],
        ];
    }

    /** Nomor di path SPK (NomorSpkPath): bentuk lain → 404 tanpa bertanya ke database. */
    #[DataProvider('workOrderNumbers')]
    public function test_work_order_number_in_path(string $number, bool $valid): void
    {
        $this->assertSame($valid, NomorSpk::sah($number));
    }

    /** @return array<string, array{int, int, LevelStok, bool}> */
    public static function stockLevels(): array
    {
        return [
            'habis' => [0, 5, LevelStok::Habis, true],
            'habis walau stok minimum 0' => [0, 0, LevelStok::Habis, true],
            'menipis di bawah minimum' => [3, 5, LevelStok::Menipis, true],
            'menipis tepat di minimum' => [5, 5, LevelStok::Menipis, true],
            'aman di atas minimum' => [6, 5, LevelStok::Aman, false],
            'aman tanpa minimum' => [1, 0, LevelStok::Aman, false],
        ];
    }

    #[DataProvider('stockLevels')]
    public function test_stock_level_and_low_stock_filter(int $stock, int $minStock, LevelStok $level, bool $lowStock): void
    {
        $this->assertSame($level, LevelStok::dari($stock, $minStock));
        $this->assertSame($lowStock, LevelStok::perluDibeli($stock, $minStock));
        // lowStock=true sama dengan level low atau out.
        $this->assertSame($lowStock, $level !== LevelStok::Aman);
    }

    public function test_stock_level_values_and_labels(): void
    {
        $this->assertSame(['ok', 'low', 'out'], array_map(fn (LevelStok $l): string => $l->value, LevelStok::cases()));
        $this->assertSame(['Aman', 'Menipis', 'Habis'], array_map(fn (LevelStok $l): string => $l->label(), LevelStok::cases()));
    }

    public function test_movement_types(): void
    {
        $this->assertSame(['IN', 'OUT', 'COUNT', 'USED', 'RETURNED'], array_map(fn (JenisPergerakan $j): string => $j->value, JenisPergerakan::cases()));
        $this->assertSame(['Stok masuk', 'Stok keluar', 'Hitung ulang', 'Terpakai SPK', 'Dikembalikan dari SPK'],
            array_map(fn (JenisPergerakan $j): string => $j->label(), JenisPergerakan::cases()));
        $this->assertSame([JenisPergerakan::Terpakai, JenisPergerakan::Kembali],
            array_values(array_filter(JenisPergerakan::cases(), fn (JenisPergerakan $j): bool => $j->dariSpk())));
        $this->assertSame([JenisPergerakan::Keluar, JenisPergerakan::HitungUlang],
            array_values(array_filter(JenisPergerakan::cases(), fn (JenisPergerakan $j): bool => $j->wajibCatatan())));
    }

    public function test_insufficient_stock_message_matches_the_spec_example(): void
    {
        $this->assertSame(
            'Stok sparepart tidak cukup: Kampas Rem Depan Vario (butuh 3 set, tersedia 2 set)',
            PesanStokKurang::susun('Kampas Rem Depan Vario', 3, 'set', 2),
        );
        // Angka polos tanpa pemisah ribuan.
        $galat = PesanStokKurang::galat('Baut M6', 1500, 'pcs', 1200);
        $this->assertSame([409, 'insufficient_stock'], [$galat->status, $galat->errorCode]);
        $this->assertSame('Stok sparepart tidak cukup: Baut M6 (butuh 1500 pcs, tersedia 1200 pcs)', $galat->getMessage());
    }

    public function test_staff_roles(): void
    {
        $this->assertSame(['owner', 'cashier', 'mechanic'], array_map(fn (Peran $p): string => $p->value, Peran::cases()));
        $this->assertSame(['Pemilik', 'Kasir', 'Mekanik'], array_map(fn (Peran $p): string => $p->label(), Peran::cases()));
    }
}
