<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Validation;

/** Aturan satu field integer. */
final class IntRule
{
    /**
     * @param  bool  $optional  tidak dikirim → $default; null tetap invalid_type,
     *                          karena kontrak hanya mengizinkan null di field nullable
     */
    public function __construct(
        public readonly int $min,
        public readonly int $max,
        public readonly bool $optional = false,
        public readonly int $default = 0,
    ) {}
}
