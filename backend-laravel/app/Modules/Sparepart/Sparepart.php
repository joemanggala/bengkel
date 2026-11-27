<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sparepart;

use App\Support\Time\Time;

/**
 * Satu baris sparepart dari tabel parts. Harga beli (costPrice) ikut dibaca,
 * tetapi hanya dikirim ke klien bila yang meminta pemilik (lihat toArray).
 */
final class Sparepart
{
    /** Kolom yang dibaca repository. */
    public const COLUMNS = [
        'part_id', 'sku', 'name', 'unit', 'price', 'cost_price',
        'stock', 'min_stock', 'is_active', 'created_at', 'updated_at',
    ];

    /** createdAt dan updatedAt berupa nilai DATETIME(3) UTC dari database. */
    public function __construct(
        public readonly string $partId,
        public readonly string $sku,
        public readonly string $name,
        public readonly string $unit,
        public readonly int $price,
        public readonly int $costPrice,
        public readonly int $stock,
        public readonly int $minStock,
        public readonly bool $isActive,
        public readonly string $createdAt,
        public readonly string $updatedAt,
    ) {}

    /** Kolom BIGINT dan BOOLEAN dipaksa ke tipe kontrak (integer dan true/false). */
    public static function fromRow(object $row): self
    {
        return new self(
            $row->part_id,
            $row->sku,
            $row->name,
            $row->unit,
            (int) $row->price,
            (int) $row->cost_price,
            (int) $row->stock,
            (int) $row->min_stock,
            (bool) $row->is_active,
            $row->created_at,
            $row->updated_at,
        );
    }

    /**
     * SparepartPemilik bila $denganHargaBeli, selain itu SparepartStaf. Untuk
     * kasir dan mekanik kunci costPrice tidak ada sama sekali (bukan null,
     * bukan 0): harga beli adalah rahasia pemilik.
     *
     * @return array<string, mixed>
     */
    public function toArray(bool $denganHargaBeli): array
    {
        $data = [
            'partId' => $this->partId,
            'sku' => $this->sku,
            'name' => $this->name,
            'unit' => $this->unit,
            'price' => $this->price,
        ];
        if ($denganHargaBeli) {
            $data['costPrice'] = $this->costPrice;
        }

        return $data + [
            'stock' => $this->stock,
            'minStock' => $this->minStock,
            'stockLevel' => LevelStok::dari($this->stock, $this->minStock)->value,
            'isActive' => $this->isActive,
            'createdAt' => Time::dbToJson($this->createdAt),
            'updatedAt' => Time::dbToJson($this->updatedAt),
        ];
    }
}
