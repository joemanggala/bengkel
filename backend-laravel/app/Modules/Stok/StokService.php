<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Stok;

use App\Modules\Sparepart\Contracts\SparepartRepositoryInterface;
use App\Modules\Sparepart\Sparepart;
use App\Modules\Stok\Contracts\StokRepositoryInterface;
use App\Support\Http\ApiError;
use App\Support\Http\Page;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use LogicException;

/**
 * Pencatatan stok manual oleh pemilik: masuk, keluar, dan hitung ulang.
 *
 * Ketiganya mengikuti pola yang sama di satu transaksi: kunci baris
 * sparepart (SELECT … FOR UPDATE) → baca stok → tulis stok baru → tambah
 * satu baris kartu stok dengan stock_after. Karena stok baru dibaca sesudah
 * kunci didapat, dua pencatatan serentak pada sparepart yang sama berjalan
 * bergiliran dan sama-sama terhitung, dan stok keluar yang kedua melihat stok
 * sesudah yang pertama (tidak pernah negatif). Sparepart nonaktif tetap boleh
 * dicatat: barang fisiknya masih ada di rak.
 */
final class StokService
{
    public function __construct(
        private readonly SparepartRepositoryInterface $parts,
        private readonly StokRepositoryInterface $stok,
        private readonly Clock $clock,
    ) {}

    /** Stok bertambah; harga beli menjadi $costPrice bila dikirim (harga beli terakhir). */
    public function masuk(string $partId, int $quantity, ?int $costPrice, string $note, string $staffId): Sparepart
    {
        return $this->catat($partId, function (Sparepart $part) use ($quantity, $costPrice, $note): array {
            return [JenisPergerakan::Masuk, $quantity, $part->stock + $quantity, $costPrice, $note];
        }, $staffId);
    }

    /**
     * Stok berkurang. Jumlah melebihi stok sekarang → 409 insufficient_stock
     * dan transaksi dibatalkan tanpa perubahan apa pun.
     */
    public function keluar(string $partId, int $quantity, string $note, string $staffId): Sparepart
    {
        return $this->catat($partId, function (Sparepart $part) use ($quantity, $note): array {
            if ($quantity > $part->stock) {
                throw PesanStokKurang::galat($part->name, $quantity, $part->unit, $part->stock);
            }

            return [JenisPergerakan::Keluar, -$quantity, $part->stock - $quantity, null, $note];
        }, $staffId);
    }

    /**
     * Stok menjadi hasil hitung. Selisihnya (boleh 0) tetap dicatat sebagai
     * bukti bahwa stok sudah dihitung pada saat itu.
     */
    public function hitung(string $partId, int $countedStock, string $note, string $staffId): Sparepart
    {
        return $this->catat($partId, function (Sparepart $part) use ($countedStock, $note): array {
            return [JenisPergerakan::HitungUlang, $countedStock - $part->stock, $countedStock, null, $note];
        }, $staffId);
    }

    /** @return array{0: list<PergerakanStok>, 1: int} */
    public function kartu(string $partId, Page $page): array
    {
        return $this->stok->kartu($partId, $page);
    }

    /**
     * Kerangka bersama ketiga pencatatan. $hitung menerima sparepart yang
     * sudah terkunci dan mengembalikan [jenis, quantity bertanda, stok
     * sesudah, harga beli baru atau null, catatan], atau melempar ApiError.
     *
     * @param  callable(Sparepart): array{0: JenisPergerakan, 1: int, 2: int, 3: int|null, 4: string}  $hitung
     */
    private function catat(string $partId, callable $hitung, string $staffId): Sparepart
    {
        return $this->parts->transaction(function () use ($partId, $hitung, $staffId): Sparepart {
            $part = $this->parts->kunci($partId) ?? throw ApiError::notFound('Sparepart tidak ditemukan');
            [$jenis, $quantity, $stockAfter, $costPrice, $note] = $hitung($part);
            $now = Time::toDb($this->clock->now());
            $this->stok->aturStok($partId, $stockAfter, $costPrice, $now);
            $this->stok->catat($partId, $jenis, $quantity, $stockAfter, $note, $staffId, $now);

            return $this->parts->ambil($partId) ?? throw new LogicException('sparepart '.$partId.' hilang');
        });
    }
}
