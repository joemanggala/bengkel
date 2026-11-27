<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Stok;

use App\Support\Time\Time;

/** Satu baris kartu stok beserta nama staf dan nomor SPK penyebabnya. */
final class PergerakanStok
{
    /** createdAt berupa nilai DATETIME(3) UTC dari database. */
    public function __construct(
        public readonly string $movementId,
        public readonly JenisPergerakan $type,
        public readonly int $quantity,
        public readonly int $stockAfter,
        public readonly string $note,
        public readonly ?string $workOrderNumber,
        public readonly string $staffId,
        public readonly string $staffName,
        public readonly string $createdAt,
    ) {}

    /**
     * Baris hasil join stock_movements + staff (+ work_orders), dengan alias
     * staff_name dan work_order_number.
     */
    public static function fromRow(object $row): self
    {
        return new self(
            $row->stock_movement_id,
            JenisPergerakan::from($row->type),
            (int) $row->quantity,
            (int) $row->stock_after,
            $row->note,
            $row->work_order_number,
            $row->staff_id,
            $row->staff_name,
            $row->created_at,
        );
    }

    /** @return array<string, mixed> skema PergerakanStok */
    public function toArray(): array
    {
        return [
            'movementId' => $this->movementId,
            'type' => $this->type->value,
            'quantity' => $this->quantity,
            'stockAfter' => $this->stockAfter,
            'note' => $this->note,
            'workOrderNumber' => $this->workOrderNumber,
            'staff' => ['staffId' => $this->staffId, 'name' => $this->staffName],
            'createdAt' => Time::dbToJson($this->createdAt),
        ];
    }
}
