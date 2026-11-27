<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Pelanggan;

use App\Support\Time\Time;

/** Satu kendaraan seperti di skema Kendaraan: plat tampilan dan kuncinya, milik satu pelanggan. */
final class Kendaraan
{
    /** Kolom tabel vehicles yang dibaca untuk membentuk objek ini. */
    public const COLUMNS = [
        'vehicle_id', 'customer_id', 'type', 'plate_display', 'plate_key',
        'brand', 'model', 'year', 'color', 'created_at', 'updated_at',
    ];

    /** createdAt dan updatedAt berupa nilai DATETIME(3) UTC dari database. */
    public function __construct(
        public readonly string $vehicleId,
        public readonly string $customerId,
        public readonly string $type,
        public readonly string $plate,
        public readonly string $plateKey,
        public readonly string $brand,
        public readonly string $model,
        public readonly ?int $year,
        public readonly string $color,
        public readonly string $createdAt,
        public readonly string $updatedAt,
    ) {}

    public static function fromRow(object $row): self
    {
        // SMALLINT bisa terbaca sebagai teks, tergantung driver; kontrak menuntut integer JSON.
        return new self(
            $row->vehicle_id,
            $row->customer_id,
            $row->type,
            $row->plate_display,
            $row->plate_key,
            $row->brand,
            $row->model,
            $row->year === null ? null : (int) $row->year,
            $row->color,
            $row->created_at,
            $row->updated_at,
        );
    }

    /** @return array<string, string|int|null> skema Kendaraan di spec */
    public function toArray(): array
    {
        return [
            'vehicleId' => $this->vehicleId,
            'customerId' => $this->customerId,
            'type' => $this->type,
            'plate' => $this->plate,
            'plateKey' => $this->plateKey,
            'brand' => $this->brand,
            'model' => $this->model,
            'year' => $this->year,
            'color' => $this->color,
            'createdAt' => Time::dbToJson($this->createdAt),
            'updatedAt' => Time::dbToJson($this->updatedAt),
        ];
    }
}
