<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

/**
 * Baris SPK yang sudah dikunci (SELECT … FOR UPDATE) di transaksi yang
 * sedang berjalan. Semua aturan 403/409 dinilai dengan nilai ini, bukan
 * dengan nilai yang dibaca sebelum transaksi, karena SPK bisa diubah
 * permintaan lain di antaranya.
 */
final class SpkTerkunci
{
    public function __construct(
        public readonly string $id,
        public readonly StatusSpk $status,
        public readonly ?string $mechanicId,
        public readonly int $serviceSubtotal,
        public readonly int $partSubtotal,
        public readonly int $paidAmount,
    ) {}

    public function total(): int
    {
        return $this->serviceSubtotal + $this->partSubtotal;
    }

    /** Sisa tagihan; tidak pernah negatif (CHECK work_orders_paid_rentang). */
    public function sisa(): int
    {
        return $this->total() - $this->paidAmount;
    }
}
