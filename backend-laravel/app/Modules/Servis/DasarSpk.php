<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

/**
 * SPK yang ditemukan dari nomornya, dibaca tanpa kunci: cukup untuk menjawab
 * 404 dan batas mekanik (403) sebelum badan divalidasi. Rute yang mengubah
 * SPK membaca ulang barisnya dengan kunci (SpkTerkunci) di dalam transaksi.
 */
final class DasarSpk
{
    public function __construct(
        public readonly string $id,
        public readonly string $number,
        public readonly ?string $mechanicId,
        public readonly StatusSpk $status,
    ) {}
}
