<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Outlet;

/**
 * Profil satu-satunya outlet (skema Outlet). Nama dan kontak bengkel selalu
 * diambil dari sini, bukan ditulis di kode, supaya pembeli langsung bisa
 * memakai identitas bengkelnya sendiri. Dipakai halaman depan website, nota,
 * halaman lacak servis, dan pesan WhatsApp.
 */
final class ProfilOutlet
{
    public function __construct(
        public readonly string $name,
        public readonly string $tagline,
        public readonly string $address,
        public readonly ?string $phone,
        public readonly string $openingHours,
        public readonly string $mapsUrl,
        public readonly string $receiptFooter,
    ) {}

    public static function fromRow(object $row): self
    {
        return new self($row->name, $row->tagline, $row->address, $row->phone, $row->opening_hours, $row->maps_url, $row->receipt_footer);
    }

    /** @return array<string, string|null> skema Outlet di spec */
    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'tagline' => $this->tagline,
            'address' => $this->address,
            'phone' => $this->phone,
            'openingHours' => $this->openingHours,
            'mapsUrl' => $this->mapsUrl,
            'receiptFooter' => $this->receiptFooter,
        ];
    }
}
