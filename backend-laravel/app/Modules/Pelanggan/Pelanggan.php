<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Pelanggan;

use App\Support\Time\Time;

/**
 * Pelanggan beserta semua kendaraannya (skema Pelanggan). Kendaraan selalu
 * ikut, karena layar SPK baru memilih kendaraan langsung dari hasil cari
 * pelanggan tanpa memanggil rincian satu per satu.
 */
final class Pelanggan
{
    /** Kolom tabel customers yang dibaca untuk membentuk objek ini. */
    public const COLUMNS = ['customer_id', 'name', 'phone', 'address', 'notes', 'created_at', 'updated_at'];

    /** @param  list<Kendaraan>  $vehicles  urut created_at naik, lalu vehicle_id naik */
    public function __construct(
        public readonly string $customerId,
        public readonly string $name,
        public readonly string $phone,
        public readonly string $address,
        public readonly string $notes,
        public readonly array $vehicles,
        public readonly string $createdAt,
        public readonly string $updatedAt,
    ) {}

    /** @param  list<Kendaraan>  $vehicles */
    public static function fromRow(object $row, array $vehicles): self
    {
        return new self($row->customer_id, $row->name, $row->phone, $row->address, $row->notes, $vehicles, $row->created_at, $row->updated_at);
    }

    /** @return array<string, mixed> skema Pelanggan di spec */
    public function toArray(): array
    {
        return [
            'customerId' => $this->customerId,
            'name' => $this->name,
            'phone' => $this->phone,
            'address' => $this->address,
            'notes' => $this->notes,
            'vehicles' => array_map(fn (Kendaraan $v): array => $v->toArray(), $this->vehicles),
            'createdAt' => Time::dbToJson($this->createdAt),
            'updatedAt' => Time::dbToJson($this->updatedAt),
        ];
    }
}
