<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sesi;

/** Peran staf (PeranStaf). Nilainya sama dengan kolom staff.role dan field role di JSON. */
enum Peran: string
{
    /** Semua yang bisa kasir, ditambah jasa, sparepart, stok, staf, outlet, dan rekap. */
    case Pemilik = 'owner';

    /** Booking, pelanggan, kendaraan, SPK, item, pembayaran, dan WhatsApp. */
    case Kasir = 'cashier';

    /** Hanya SPK yang ditugaskan kepadanya: melihat, mengubah status, dan mengisi diagnosis. */
    case Mekanik = 'mechanic';

    /** Label Indonesia (x-label PeranStaf). */
    public function label(): string
    {
        return match ($this) {
            self::Pemilik => 'Pemilik',
            self::Kasir => 'Kasir',
            self::Mekanik => 'Mekanik',
        };
    }
}
