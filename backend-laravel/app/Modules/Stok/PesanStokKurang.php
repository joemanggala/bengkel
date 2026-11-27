<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Stok;

use App\Support\Http\ApiError;

/**
 * Pesan 409 insufficient_stock. Formatnya baku (spec, bagian "Sparepart dan
 * stok") dan harus sama persis di ketiga backend, karena kasir membacanya di
 * layar. Angka ditulis polos tanpa pemisah ribuan:
 *
 *   Stok sparepart tidak cukup: Kampas Rem Depan Vario (butuh 3 set, tersedia 2 set)
 *
 * Satu permintaan hanya menyangkut satu sparepart (satu item SPK atau satu
 * stok keluar), jadi pesannya selalu menyebut tepat satu nama.
 */
final class PesanStokKurang
{
    public static function susun(string $nama, int $butuh, string $satuan, int $tersedia): string
    {
        return sprintf('Stok sparepart tidak cukup: %s (butuh %d %s, tersedia %d %s)', $nama, $butuh, $satuan, $tersedia, $satuan);
    }

    /** Galat 409 siap dilempar service. */
    public static function galat(string $nama, int $butuh, string $satuan, int $tersedia): ApiError
    {
        return ApiError::insufficientStock(self::susun($nama, $butuh, $satuan, $tersedia));
    }
}
