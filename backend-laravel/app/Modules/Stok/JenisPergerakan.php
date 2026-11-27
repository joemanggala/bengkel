<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Stok;

/**
 * Jenis baris kartu stok (JenisPergerakan). Nilainya sama dengan kolom
 * stock_movements.type. Tanda jumlahnya mengikuti jenis (dijaga juga oleh
 * CHECK stock_movements_tanda_sesuai), sehingga jumlah semua quantity kartu
 * stok sebuah sparepart selalu sama dengan stoknya.
 */
enum JenisPergerakan: string
{
    /** Stok masuk (belanja, stok awal); quantity positif. */
    case Masuk = 'IN';

    /** Keluar manual (rusak, hilang), wajib catatan; quantity negatif. */
    case Keluar = 'OUT';

    /** Hitung ulang (opname), wajib catatan; quantity = selisihnya, boleh 0. */
    case HitungUlang = 'COUNT';

    /** Terpakai karena item part ditambahkan ke SPK; quantity negatif. */
    case Terpakai = 'USED';

    /** Kembali karena item part dihapus atau SPK dibatalkan; quantity positif. */
    case Kembali = 'RETURNED';

    /** Label Indonesia (x-label JenisPergerakan). */
    public function label(): string
    {
        return match ($this) {
            self::Masuk => 'Stok masuk',
            self::Keluar => 'Stok keluar',
            self::HitungUlang => 'Hitung ulang',
            self::Terpakai => 'Terpakai SPK',
            self::Kembali => 'Dikembalikan dari SPK',
        };
    }

    /** Baris yang disebabkan SPK wajib menunjuk SPK-nya; baris lain tidak boleh. */
    public function dariSpk(): bool
    {
        return $this === self::Terpakai || $this === self::Kembali;
    }

    /** Keluar manual dan hitung ulang wajib punya catatan alasan. */
    public function wajibCatatan(): bool
    {
        return $this === self::Keluar || $this === self::HitungUlang;
    }
}
