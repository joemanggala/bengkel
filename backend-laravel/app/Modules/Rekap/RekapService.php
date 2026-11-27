<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Rekap;

use App\Modules\Rekap\Contracts\RekapRepositoryInterface;
use DateTimeImmutable;

/**
 * Rekap satu tanggal WIB (skema RekapHarian).
 *
 * Nilai, modal, laba, dan terlaris dihitung dari SPK yang SELESAI (DONE) di
 * tanggal itu, bukan dari tanggal SPK dibuat: SPK bengkel
 * bisa berhari-hari dan itemnya baru final saat DONE, jadi angka hari yang
 * sudah lewat tidak berubah lagi. "SPK masuk" tetap dari tanggal dibuat, dan
 * uang diterima dari tanggal pembayaran (uang muka dihitung di hari
 * diterimanya). SPK batal tidak pernah sampai DONE, jadi tidak menyumbang
 * nilai apa pun.
 */
final class RekapService
{
    /** Jumlah baris jasa dan sparepart terlaris. */
    public const BATAS_TERLARIS = 5;

    public function __construct(private readonly RekapRepositoryInterface $repo) {}

    /**
     * @param  string  $date  tanggal WIB yang sudah divalidasi
     * @param  array{0: DateTimeImmutable, 1: DateTimeImmutable}  $rentang  hari WIB itu dalam UTC (Wib::hari)
     * @return array<string, mixed>
     */
    public function harian(string $date, array $rentang): array
    {
        [$mulai, $akhir] = $rentang;

        return $this->repo->dalamPotret(function () use ($date, $mulai, $akhir): array {
            $linimasa = $this->repo->jumlahLinimasa($mulai, $akhir);
            $nilai = $this->repo->nilaiSelesai($mulai, $akhir);
            $modal = $this->repo->modalSelesai($mulai, $akhir);
            $bayar = $this->repo->pembayaranPerMetode($mulai, $akhir);
            $salesTotal = $nilai['serviceTotal'] + $nilai['partTotal'];

            return [
                'date' => $date,
                'workOrderCount' => $this->repo->jumlahSpkMasuk($mulai, $akhir),
                'doneCount' => $linimasa['DONE'],
                'pickedUpCount' => $linimasa['PICKED_UP'],
                'cancelledCount' => $linimasa['CANCELLED'],
                'serviceTotal' => $nilai['serviceTotal'],
                'partTotal' => $nilai['partTotal'],
                'salesTotal' => $salesTotal,
                'partCostTotal' => $modal['partCostTotal'],
                // Jasa bermodal 0, jadi laba kotor = nilai SPK − modal part; boleh negatif.
                'grossProfit' => $salesTotal - $modal['partCostTotal'],
                'partItemsWithoutCost' => $modal['partItemsWithoutCost'],
                'paymentTotal' => $bayar['cash'] + $bayar['transfer'] + $bayar['qris'],
                'paymentsByMethod' => $bayar,
                'topServices' => $this->repo->jasaTerlaris($mulai, $akhir, self::BATAS_TERLARIS),
                'topParts' => array_map(
                    fn (array $p): array => $p + ['profit' => $p['revenue'] - $p['cost']],
                    $this->repo->partTerlaris($mulai, $akhir, self::BATAS_TERLARIS),
                ),
                'doneByMechanic' => $this->repo->selesaiPerMekanik($mulai, $akhir),
            ];
        });
    }
}
