<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Sesi\Peran;
use App\Support\Http\ApiError;

/**
 * Aturan murni SPK yang menghasilkan 403/409, tanpa database supaya mudah
 * diuji. Service memanggilnya di dalam transaksi, sesudah baris SPK dikunci,
 * dengan nilai yang baru dibaca; urutan pemeriksaan di setiap metode sama
 * persis dengan deskripsi operasinya di spec, karena tes kontrak menilai
 * kode mana yang menang bila beberapa syarat sekaligus dilanggar.
 *
 * Kepemilikan SPK oleh mekanik (403 sesudah 404, sebelum 422) ada di
 * BatasMekanik, karena dinilai pada titik yang berbeda.
 */
final class AturanSpk
{
    /**
     * POST /api/work-orders/{number}/status, bagian sesudah 422:
     *  1. mekanik menuju PICKED_UP → 403 forbidden;
     *  2. perpindahan tidak sah → 409 status_transition_invalid;
     *  3. menuju DONE tanpa satu item pun → 409 work_order_empty (pesan
     *     "siap diambil" bertotal Rp0 membingungkan pelanggan, dan item
     *     terkunci sejak DONE);
     *  4. menuju PICKED_UP dengan sisa tagihan > 0 → 409 not_paid_off.
     *     SPK bertotal 0 (mis. servis garansi) boleh langsung diambil.
     */
    public static function ubahStatus(StatusSpk $dari, StatusSpk $ke, Peran $peran, int $jumlahItem, int $sisaTagihan): void
    {
        if ($peran === Peran::Mekanik && ! $ke->bolehDitujuMekanik()) {
            throw ApiError::forbidden();
        }
        if (! $dari->bolehKe($ke)) {
            throw ApiError::conflict('status_transition_invalid');
        }
        if ($ke === StatusSpk::Selesai && $jumlahItem === 0) {
            throw ApiError::conflict('work_order_empty');
        }
        if ($ke === StatusSpk::Diambil && $sisaTagihan > 0) {
            throw ApiError::conflict('not_paid_off');
        }
    }

    /**
     * POST /api/work-orders/{number}/cancel, sesudah 422: status bukan
     * QUEUED, IN_PROGRESS, atau WAITING_PARTS → status_transition_invalid;
     * sudah ada pembayaran → has_payments (tidak ada void/refund).
     */
    public static function batal(StatusSpk $status, int $terbayar): void
    {
        if (! $status->bolehDibatalkan()) {
            throw ApiError::conflict('status_transition_invalid');
        }
        if ($terbayar > 0) {
            throw ApiError::conflict('has_payments');
        }
    }

    /**
     * PATCH SPK, tambah item, dan hapus item: hanya selama SPK terbuka;
     * selain itu 409 work_order_locked.
     */
    public static function ubahData(StatusSpk $status): void
    {
        if (! $status->terbuka()) {
            throw ApiError::conflict('work_order_locked');
        }
    }

    /**
     * Menghapus item tidak boleh membuat total di bawah yang sudah dibayar:
     * uang muka boleh sejak SPK dibuat, dan terbayar tidak pernah
     * melebihi total (CHECK work_orders_paid_rentang).
     */
    public static function hapusItem(int $total, int $subtotalItem, int $terbayar): void
    {
        if ($total - $subtotalItem < $terbayar) {
            throw ApiError::conflict('total_below_paid');
        }
    }

    /**
     * POST /api/work-orders/{number}/payments, bagian status: SPK
     * CANCELLED → work_order_cancelled; PICKED_UP → already_picked_up.
     * Batas jumlah (1 sampai sisa tagihan) dinilai pemanggil sesudahnya.
     */
    public static function bayar(StatusSpk $status): void
    {
        if ($status === StatusSpk::Dibatalkan) {
            throw ApiError::conflict('work_order_cancelled');
        }
        if ($status === StatusSpk::Diambil) {
            throw ApiError::conflict('already_picked_up');
        }
    }

    /**
     * POST /api/work-orders/{number}/wa: SPK CANCELLED → work_order_cancelled
     * untuk semua jenis; work_order_done hanya untuk DONE atau PICKED_UP
     * (selain itu work_order_not_done). work_order_created dan receipt boleh
     * di status apa pun selain CANCELLED.
     */
    public static function kirimUlangWa(StatusSpk $status, string $jenis): void
    {
        if ($status === StatusSpk::Dibatalkan) {
            throw ApiError::conflict('work_order_cancelled');
        }
        if ($jenis === 'work_order_done' && $status !== StatusSpk::Selesai && $status !== StatusSpk::Diambil) {
            throw ApiError::conflict('work_order_not_done');
        }
    }
}
