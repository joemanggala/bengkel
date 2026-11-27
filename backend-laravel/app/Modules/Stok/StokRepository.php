<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Stok;

use App\Modules\Stok\Contracts\StokRepositoryInterface;
use App\Support\Http\Page;
use App\Support\Security\Uuid;
use Illuminate\Support\Facades\DB;

final class StokRepository implements StokRepositoryInterface
{
    public function aturStok(string $partId, int $stock, ?int $costPrice, string $now): void
    {
        $changes = ['stock' => $stock, 'updated_at' => $now];
        if ($costPrice !== null) {
            $changes['cost_price'] = $costPrice;
        }
        DB::table('parts')->where('part_id', $partId)->update($changes);
    }

    public function catat(
        string $partId,
        JenisPergerakan $jenis,
        int $quantity,
        int $stockAfter,
        string $note,
        string $staffId,
        string $now,
    ): void {
        DB::table('stock_movements')->insert([
            'stock_movement_id' => Uuid::new(),
            'part_id' => $partId,
            'type' => $jenis->value,
            'quantity' => $quantity,
            'stock_after' => $stockAfter,
            'note' => $note,
            'work_order_id' => null,
            'staff_id' => $staffId,
            'created_at' => $now,
        ]);
    }

    public function kartu(string $partId, Page $page): array
    {
        $total = DB::table('stock_movements')->where('part_id', $partId)->count();
        // Staf tidak pernah dihapus, jadi join biasa aman; SPK hanya ada
        // untuk USED dan RETURNED, jadi left join.
        $rows = DB::table('stock_movements as m')
            ->join('staff as s', 's.staff_id', '=', 'm.staff_id')
            ->leftJoin('work_orders as w', 'w.work_order_id', '=', 'm.work_order_id')
            ->where('m.part_id', $partId)
            ->orderByDesc('m.created_at')->orderByDesc('m.stock_movement_id')
            ->offset($page->offset())->limit($page->limit)
            ->get([
                'm.stock_movement_id', 'm.type', 'm.quantity', 'm.stock_after', 'm.note',
                'm.staff_id', 's.name as staff_name', 'w.number as work_order_number', 'm.created_at',
            ]);

        return [$rows->map(fn (object $row) => PergerakanStok::fromRow($row))->all(), $total];
    }
}
