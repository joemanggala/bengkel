<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Rekap\Contracts;

use DateTimeImmutable;

/**
 * Bacaan untuk rekap harian. Setiap metode menerima rentang UTC satu hari WIB
 * [mulai, akhir). "SPK selesai hari itu" = SPK yang baris linimasa DONE-nya
 * jatuh di rentang itu (lihat RekapService). Semua metode dipanggil di dalam
 * dalamPotret(), supaya angka-angkanya berasal dari satu keadaan database.
 */
interface RekapRepositoryInterface
{
    /**
     * Menjalankan $callback dalam satu transaksi baca REPEATABLE READ: semua
     * query di dalamnya melihat potret database yang sama, jadi pembayaran
     * atau status yang berubah di tengah rekap tidak membuat angka saling
     * bertentangan.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function dalamPotret(callable $callback): mixed;

    /** SPK masuk: dibuat di rentang itu dan statusnya sekarang bukan CANCELLED. */
    public function jumlahSpkMasuk(DateTimeImmutable $mulai, DateTimeImmutable $akhir): int;

    /**
     * Jumlah baris linimasa per status tujuan DONE, PICKED_UP, dan CANCELLED.
     *
     * @return array{DONE: int, PICKED_UP: int, CANCELLED: int}
     */
    public function jumlahLinimasa(DateTimeImmutable $mulai, DateTimeImmutable $akhir): array;

    /**
     * Nilai SPK selesai hari itu.
     *
     * @return array{serviceTotal: int, partTotal: int}
     */
    public function nilaiSelesai(DateTimeImmutable $mulai, DateTimeImmutable $akhir): array;

    /**
     * Modal part SPK selesai hari itu dan jumlah baris item part yang harga belinya 0.
     *
     * @return array{partCostTotal: int, partItemsWithoutCost: int}
     */
    public function modalSelesai(DateTimeImmutable $mulai, DateTimeImmutable $akhir): array;

    /**
     * Pembayaran yang created_at-nya di rentang itu, per metode.
     *
     * @return array{cash: int, transfer: int, qris: int}
     */
    public function pembayaranPerMetode(DateTimeImmutable $mulai, DateTimeImmutable $akhir): array;

    /**
     * Hingga $batas jasa terlaris di SPK selesai hari itu.
     *
     * @return list<array{serviceId: string, name: string, quantity: int, revenue: int}>
     */
    public function jasaTerlaris(DateTimeImmutable $mulai, DateTimeImmutable $akhir, int $batas): array;

    /**
     * Hingga $batas sparepart terlaris di SPK selesai hari itu.
     *
     * @return list<array{partId: string, name: string, quantity: int, revenue: int, cost: int}>
     */
    public function partTerlaris(DateTimeImmutable $mulai, DateTimeImmutable $akhir, int $batas): array;

    /**
     * Jumlah SPK selesai hari itu per mekanik; mekanik null untuk SPK tanpa mekanik.
     *
     * @return list<array{mechanic: array{staffId: string, name: string}|null, doneCount: int}>
     */
    public function selesaiPerMekanik(DateTimeImmutable $mulai, DateTimeImmutable $akhir): array;
}
