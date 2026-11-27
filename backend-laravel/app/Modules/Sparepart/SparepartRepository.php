<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sparepart;

use App\Modules\Sparepart\Contracts\SparepartRepositoryInterface;
use App\Support\Database\Like;
use App\Support\Database\SearchTerm;
use App\Support\Database\SqlError;
use App\Support\Database\Transaksi;
use App\Support\Http\ApiError;
use App\Support\Http\Page;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Throwable;

final class SparepartRepository implements SparepartRepositoryInterface
{
    /** Indeks unik SKU (ascii_bin, jadi dibandingkan persis). */
    private const SKU_KEY = 'parts_sku_key';

    public function transaction(callable $callback): mixed
    {
        return Transaksi::jalankan($callback);
    }

    public function daftar(?bool $isActive, ?bool $lowStock, SearchTerm $search, Page $page): array
    {
        $query = DB::table('parts');
        if ($isActive !== null) {
            $query->where('is_active', $isActive);
        }
        if ($lowStock !== null) {
            // Sama dengan LevelStok::perluDibeli: stock <= min_stock berarti
            // level low atau out.
            $query->whereColumn('stock', $lowStock ? '<=' : '>', 'min_stock');
        }
        if (! $search->isEmpty()) {
            $this->cari($query, $search);
        }

        $total = (clone $query)->count();
        $rows = $query->orderBy('name')->orderBy('part_id')
            ->offset($page->offset())->limit($page->limit)->get(Sparepart::COLUMNS);

        return [$rows->map(fn (object $row) => Sparepart::fromRow($row))->all(), $total];
    }

    public function ambil(string $partId): ?Sparepart
    {
        $row = DB::table('parts')->where('part_id', $partId)->first(Sparepart::COLUMNS);

        return $row === null ? null : Sparepart::fromRow($row);
    }

    public function kunci(string $partId): ?Sparepart
    {
        $row = DB::table('parts')->where('part_id', $partId)->lockForUpdate()->first(Sparepart::COLUMNS);

        return $row === null ? null : Sparepart::fromRow($row);
    }

    public function simpanBaru(string $partId, array $values, int $stock, string $now): void
    {
        try {
            DB::table('parts')->insert(['part_id' => $partId] + $values + [
                'stock' => $stock,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } catch (QueryException $e) {
            throw $this->skuKembar($e);
        }
    }

    public function ubah(string $partId, array $changes, string $now): void
    {
        try {
            DB::table('parts')->where('part_id', $partId)->update($changes + ['updated_at' => $now]);
        } catch (QueryException $e) {
            throw $this->skuKembar($e);
        }
    }

    /**
     * search mencocokkan nama (collation kolom: huruf besar/kecil dan aksen
     * tidak membedakan) atau SKU (term dibesarkan). Term non-ASCII tidak
     * pernah cocok dengan kolom SKU yang ascii_bin, jadi kondisinya
     * dilewatkan; membandingkannya justru bisa memicu galat collation.
     */
    private function cari(Builder $query, SearchTerm $search): void
    {
        $sku = $search->forNumber();
        $query->where(function (Builder $q) use ($search, $sku): void {
            $q->whereRaw('name '.Like::CONTAINS, [$search->forName()]);
            if ($sku !== null) {
                $q->orWhereRaw('sku '.Like::CONTAINS, [$sku]);
            }
        });
    }

    /** Keunikan SKU dijaga indeks unik, juga untuk dua sparepart yang dibuat serentak. */
    private function skuKembar(QueryException $e): Throwable
    {
        return SqlError::isDuplicateKey($e, self::SKU_KEY) ? ApiError::conflict('sku_taken') : $e;
    }
}
