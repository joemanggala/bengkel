<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Migrasi;

use RuntimeException;

/**
 * Migrasi sebelumnya gagal di tengah jalan. Isi database perlu diperiksa dan
 * diperbaiki dulu, lalu versinya ditetapkan dengan Pelaksana::paksa().
 */
final class MigrasiKotor extends RuntimeException
{
    public function __construct(public readonly int $versi)
    {
        parent::__construct(sprintf('migrasi versi %d pernah gagal di tengah jalan (status kotor). '
            .'Perbaiki penyebabnya, lalu jalankan "paksa %d" bila perubahan versi itu sudah lengkap, '
            .'atau "paksa %d" bila belum sama sekali; cara termudah di laptop: hapus database, buat lagi, lalu migrasi dari awal',
            $versi, $versi, $versi - 1));
    }
}
