<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

/**
 * Status bayar SPK (StatusBayar). Tidak disimpan di database: selalu
 * diturunkan dari paid_amount dan total, supaya tidak pernah bertentangan
 * dengan uang yang tercatat.
 */
enum StatusBayar: string
{
    case Belum = 'unpaid';

    case Sebagian = 'partial';

    case Lunas = 'paid';

    /**
     * Lunas bila yang dibayar sama dengan total, termasuk SPK bertotal 0
     * (keputusan 0a-14: satu rumus untuk semua backend); sebagian bila sudah
     * ada pembayaran; selain itu belum. Terbayar tidak pernah melebihi total
     * (CHECK work_orders_paid_rentang).
     */
    public static function dari(int $total, int $dibayar): self
    {
        return match (true) {
            $dibayar === $total => self::Lunas,
            $dibayar > 0 => self::Sebagian,
            default => self::Belum,
        };
    }

    /** Label Indonesia (x-label StatusBayar). */
    public function label(): string
    {
        return match ($this) {
            self::Belum => 'Belum bayar',
            self::Sebagian => 'Bayar sebagian',
            self::Lunas => 'Lunas',
        };
    }
}
