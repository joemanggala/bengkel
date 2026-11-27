<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\WhatsApp;

/** Kendaraan seperti ditulis di pesan WhatsApp: {kendaraan} di spec/whatsapp.md bagian 4. */
final class KendaraanPesan
{
    public function __construct(
        public readonly string $plate,
        public readonly string $brand,
        public readonly string $model,
    ) {}

    /** "B 1234 XYZ (Honda Vario 125)"; tanpa tipe: "D 1 (Toyota)". */
    public function teks(): string
    {
        return $this->model === '' ? $this->plate.' ('.$this->brand.')' : $this->plate.' ('.$this->brand.' '.$this->model.')';
    }
}
