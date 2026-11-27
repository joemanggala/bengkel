<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis\Contracts;

use App\Modules\Servis\DasarSpk;
use App\Modules\Servis\FilterDaftar;
use App\Modules\Servis\SpkBaru;
use App\Modules\Servis\SpkTerkunci;
use App\Support\Http\Page;

/**
 * Akses data SPK: work_orders, work_order_items, work_order_status_logs,
 * payments, dan stok sparepart yang disentuh item SPK. Metode bernama
 * kunci…/ubah…/simpan… hanya dipanggil di dalam transaction().
 *
 * Baris baca (baris, item, pembayaran, linimasa) dikembalikan sebagai objek
 * kolom database apa adanya; PenyajiSpk yang menyusunnya menjadi JSON.
 */
interface ServisRepositoryInterface
{
    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function transaction(callable $callback): mixed;

    // --- Baca -------------------------------------------------------------------

    public function cariNomor(string $number): ?DasarSpk;

    /** work_order_id pemilik token lacak, atau null. */
    public function cariToken(string $trackingToken): ?string;

    /** Baris SPK beserta pelanggan, kendaraan, mekanik, pembuat, dan booking asal. */
    public function baris(string $workOrderId): ?object;

    /** @return list<object> urut nomor baris */
    public function item(string $workOrderId): array;

    /** @return list<object> urut created_at, lalu payment_id */
    public function pembayaran(string $workOrderId): array;

    /** @return list<object> urut created_at (baris pembuka lebih dulu) */
    public function linimasa(string $workOrderId): array;

    /** @return array{0: list<object>, 1: int} baris satu halaman dan jumlah seluruh baris yang cocok */
    public function daftar(FilterDaftar $filter, Page $page): array;

    /** customer_id pemilik kendaraan, atau null bila kendaraan tidak ada. */
    public function pemilikKendaraan(string $vehicleId): ?string;

    /** Staf calon mekanik {role, is_active}, atau null. */
    public function staf(string $staffId): ?object;

    /** Jasa {name, price, is_active}, atau null. */
    public function jasa(string $serviceId): ?object;

    /** Sparepart {name, unit, price, cost_price, stock, is_active}, atau null; $kunci = FOR UPDATE. */
    public function part(string $partId, bool $kunci = false): ?object;

    /** Item milik SPK itu {type, part_id, quantity, subtotal}, atau null. */
    public function itemSpk(string $workOrderId, string $itemId): ?object;

    // --- Tulis (di dalam transaksi) ---------------------------------------------

    /** Menaikkan counters.work_order_number di bawah kunci baris dan mengembalikan nilai barunya. */
    public function nomorBaru(): int;

    public function simpanSpk(string $id, string $number, string $trackingToken, SpkBaru $spk, string $staffId, string $now): void;

    public function catatLinimasa(string $workOrderId, ?string $dari, string $ke, string $staffId, string $note, string $now): void;

    public function kunci(string $workOrderId): ?SpkTerkunci;

    /** @param  array<string, mixed>  $kolom */
    public function ubah(string $workOrderId, array $kolom, string $now): void;

    public function jumlahItem(string $workOrderId): int;

    /**
     * @param  array{type: string, service_id: ?string, part_id: ?string, item_name: string, price: int, cost_price: int, quantity: int}  $item
     */
    public function simpanItem(string $workOrderId, string $itemId, array $item, string $staffId, string $now): void;

    public function hapusItem(string $itemId): void;

    /** Menghitung ulang subtotal dan total SPK dari itemnya, sekaligus updated_at. */
    public function hitungUlangTotal(string $workOrderId, string $now): void;

    /**
     * Mengubah stok sparepart yang sudah dikunci dan mencatat kartu stoknya
     * (USED bila $jumlah negatif, RETURNED bila positif).
     */
    public function geserStok(string $partId, int $jumlah, string $workOrderId, string $staffId, string $now): void;

    /** @return array<string, int> part_id → jumlah quantity item PART yang masih ada, urut part_id naik */
    public function partTertahan(string $workOrderId): array;

    public function simpanPembayaran(string $workOrderId, int $amount, string $method, string $staffId, string $now): void;
}
