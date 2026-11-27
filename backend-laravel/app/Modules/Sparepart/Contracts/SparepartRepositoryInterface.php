<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sparepart\Contracts;

use App\Modules\Sparepart\Sparepart;
use App\Support\Database\SearchTerm;
use App\Support\Http\Page;

/** Akses data sparepart (tabel parts). Stok diubah lewat modul Stok, bukan di sini. */
interface SparepartRepositoryInterface
{
    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function transaction(callable $callback): mixed;

    /**
     * Satu halaman sparepart, urut name (collation kolom) lalu part_id, beserta
     * jumlah semua baris yang cocok dengan filter.
     *
     * @param  bool|null  $lowStock  true = stock <= min_stock, false = stock > min_stock, null = semua
     * @return array{0: list<Sparepart>, 1: int}
     */
    public function daftar(?bool $isActive, ?bool $lowStock, SearchTerm $search, Page $page): array;

    public function ambil(string $partId): ?Sparepart;

    /** SELECT … FOR UPDATE; hanya di dalam transaksi. */
    public function kunci(string $partId): ?Sparepart;

    /**
     * INSERT sparepart baru (aktif) dengan stok awal. SKU kembar (indeks
     * parts_sku_key) → ApiError 409 sku_taken.
     *
     * @param  array<string, mixed>  $values  kolom dari SparepartInput::buat
     */
    public function simpanBaru(string $partId, array $values, int $stock, string $now): void;

    /**
     * UPDATE hanya kolom yang diberikan, ditambah updated_at; kolom stock
     * tidak pernah ada di $changes. SKU kembar → ApiError 409 sku_taken.
     *
     * @param  array<string, mixed>  $changes
     */
    public function ubah(string $partId, array $changes, string $now): void;
}
