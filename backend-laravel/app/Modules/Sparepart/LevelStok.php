<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sparepart;

/**
 * Tanda stok sparepart (LevelStok), dihitung server dari stock dan minStock
 * supaya semua klien menampilkan tanda yang sama. Tidak disimpan.
 */
enum LevelStok: string
{
    case Aman = 'ok';

    case Menipis = 'low';

    case Habis = 'out';

    /**
     * out bila stok 0 (walau minStock juga 0); low bila 0 < stock <= minStock;
     * ok bila stock > minStock.
     */
    public static function dari(int $stock, int $minStock): self
    {
        return match (true) {
            $stock === 0 => self::Habis,
            $stock <= $minStock => self::Menipis,
            default => self::Aman,
        };
    }

    /**
     * Filter ?lowStock=true (sparepart yang perlu dibeli): stock <= minStock,
     * sama dengan level low atau out.
     */
    public static function perluDibeli(int $stock, int $minStock): bool
    {
        return $stock <= $minStock;
    }

    /** Label Indonesia (x-label LevelStok). */
    public function label(): string
    {
        return match ($this) {
            self::Aman => 'Aman',
            self::Menipis => 'Menipis',
            self::Habis => 'Habis',
        };
    }
}
