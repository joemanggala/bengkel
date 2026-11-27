<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Migrasi;

/** Isi tabel catatan versi. */
final readonly class Status
{
    /**
     * @param  bool  $ada  false berarti belum ada migrasi yang pernah dijalankan sampai utuh
     * @param  bool  $kotor  migrasi versi ini pernah gagal di tengah jalan
     */
    public function __construct(
        public bool $ada,
        public int $versi,
        public bool $kotor,
    ) {}

    /** Database yang belum pernah dimigrasi (tabel catatan versi kosong atau belum ada). */
    public static function kosong(): self
    {
        return new self(false, 0, false);
    }
}
