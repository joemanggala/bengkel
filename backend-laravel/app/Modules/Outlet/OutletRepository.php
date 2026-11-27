<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Outlet;

use App\Modules\Outlet\Contracts\OutletRepositoryInterface;
use App\Support\Database\Transaksi;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class OutletRepository implements OutletRepositoryInterface
{
    /** Baris outlet dibuat migration dan tidak pernah dihapus. */
    private const ID = 1;

    public function ambil(): ProfilOutlet
    {
        $row = DB::table('outlet')->where('outlet_id', self::ID)
            ->first(['name', 'tagline', 'address', 'phone', 'opening_hours', 'maps_url', 'receipt_footer']);
        if ($row === null) {
            throw new RuntimeException('baris outlet tidak ada; jalankan migration');
        }

        return ProfilOutlet::fromRow($row);
    }

    /**
     * Baris outlet juga dipakai sebagai mutex perubahan staf, jadi UPDATE ini
     * bisa menunggu atau bentrok dengannya; transaksi mengulangnya.
     */
    public function simpan(ProfilOutlet $profil, string $now): void
    {
        Transaksi::jalankan(fn () => DB::table('outlet')->where('outlet_id', self::ID)->update([
            'name' => $profil->name,
            'tagline' => $profil->tagline,
            'address' => $profil->address,
            'phone' => $profil->phone,
            'opening_hours' => $profil->openingHours,
            'maps_url' => $profil->mapsUrl,
            'receipt_footer' => $profil->receiptFooter,
            'updated_at' => $now,
        ]));
    }
}
