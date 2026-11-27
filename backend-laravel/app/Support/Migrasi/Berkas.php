<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Migrasi;

/** Satu berkas migrasi arah naik, mis. 000001_awal.up.sql. */
final readonly class Berkas
{
    public function __construct(
        public int $versi,
        public string $nama,
        public string $isi,
    ) {}
}
