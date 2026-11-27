<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Stok\Contracts;

use App\Modules\Stok\JenisPergerakan;
use App\Modules\Stok\PergerakanStok;
use App\Support\Http\Page;

/**
 * Akses data kartu stok (tabel stock_movements) dan kolom stok sparepart.
 * Setiap perubahan stok di modul ini terdiri dari dua langkah di transaksi
 * yang sama, sesudah baris sparepart dikunci: aturStok() lalu catat().
 */
interface StokRepositoryInterface
{
    /**
     * Menulis stok baru sparepart (dan harga beli bila tidak null) beserta
     * updated_at. Pemanggil wajib sudah mengunci barisnya.
     */
    public function aturStok(string $partId, int $stock, ?int $costPrice, string $now): void;

    /**
     * Menambah satu baris kartu stok. $stockAfter = stok sesudah perubahan
     * ini; work_order_id selalu NULL karena baris dari SPK (USED/RETURNED)
     * ditulis modul Servis.
     */
    public function catat(
        string $partId,
        JenisPergerakan $jenis,
        int $quantity,
        int $stockAfter,
        string $note,
        string $staffId,
        string $now,
    ): void;

    /**
     * Satu halaman kartu stok satu sparepart, terbaru dulu (created_at turun,
     * lalu stock_movement_id turun), beserta jumlah semua barisnya.
     *
     * @return array{0: list<PergerakanStok>, 1: int}
     */
    public function kartu(string $partId, Page $page): array;
}
